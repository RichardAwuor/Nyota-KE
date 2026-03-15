import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { apiCall } from '@/utils/api';
import { COUNTIES } from '@/constants/counties';
import { Picker } from '@react-native-picker/picker';

export default function RegisterClientScreen() {
  const router = useRouter();
  const { setUser } = useUser();

  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedCounty, setSelectedCounty] = useState(COUNTIES[46].countyCode);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    console.log('[RegisterClient] Register button pressed', { email, firstName, lastName, county: selectedCounty });
    if (!email || !confirmEmail || !firstName || !lastName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (email !== confirmEmail) {
      Alert.alert('Error', 'Email addresses do not match');
      return;
    }

    setLoading(true);
    try {
      console.log('[RegisterClient] POST /api/users/register-client');
      const response = await apiCall('/api/users/register-client', {
        method: 'POST',
        body: JSON.stringify({ email, firstName, lastName, county: selectedCounty }),
      });

      setUser({
        id: response.user.id,
        email: response.user.email,
        userType: 'client',
        firstName: response.user.firstName,
        lastName: response.user.lastName,
        county: response.user.county,
      });

      router.replace('/(tabs)');
    } catch (error) {
      console.log('[RegisterClient] Registration error:', error);
      Alert.alert('Registration Failed', error instanceof Error ? error.message : 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Client Registration</Text>
        <Text style={styles.subtitle}>Create your account to post gigs</Text>

        <Text style={styles.label}>First Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your first name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Last Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your last name"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Confirm Email *</Text>
        <TextInput
          style={[styles.input, confirmEmail.length > 0 && email !== confirmEmail && styles.inputError]}
          placeholder="Re-enter your email"
          value={confirmEmail}
          onChangeText={setConfirmEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {confirmEmail.length > 0 && email !== confirmEmail && (
          <Text style={styles.errorText}>Emails do not match</Text>
        )}

        <Text style={styles.label}>County *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedCounty}
            onValueChange={(val) => setSelectedCounty(val)}
            style={styles.picker}
          >
            {COUNTIES.map((c) => (
              <Picker.Item key={c.countyCode} label={c.countyName} value={c.countyCode} />
            ))}
          </Picker>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 28 },
  label: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 14, fontSize: 16, backgroundColor: '#fafafa', color: '#111',
  },
  inputError: { borderColor: '#FF3B30' },
  errorText: { color: '#FF3B30', fontSize: 13, marginTop: 4 },
  pickerContainer: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    backgroundColor: '#fafafa', overflow: 'hidden',
  },
  picker: { height: 52, color: '#111' },
  button: {
    backgroundColor: '#E53935', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 32,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
