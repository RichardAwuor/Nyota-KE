import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
// Alert kept for client-side validation errors (missing fields, invalid email)
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@/contexts/UserContext';
import { BACKEND_URL } from '@/utils/api';
import { COUNTIES } from '@/constants/counties';
import { Picker } from '@react-native-picker/picker';

function parseRegistrationError(error: unknown): string {
  if (error instanceof TypeError) {
    // Network-level failure (no response at all)
    return 'Connection failed. Please check your internet and try again.';
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('email already') || msg.includes('duplicate') || msg.includes('already in use') || msg.includes('already exists')) {
      return 'An account with this email already exists. Please use a different email or log in.';
    }
    if (msg === 'bad request' || msg.includes('api request failed with status 400')) {
      return 'Please check your details and try again.';
    }
    if (error.message && error.message !== 'Bad Request') {
      return error.message;
    }
  }
  return 'Something went wrong. Please try again.';
}

export default function RegisterClientScreen() {
  const router = useRouter();
  const { setUser } = useUser();

  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [emailMismatch, setEmailMismatch] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedCounty, setSelectedCounty] = useState(COUNTIES[46].countyCode);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const emailTrimmed = email.trim().toLowerCase();
  const confirmEmailTrimmed = confirmEmail.trim().toLowerCase();
  const emailsMatch = emailTrimmed.length > 0 && confirmEmailTrimmed.length > 0 && emailTrimmed === confirmEmailTrimmed;
  const emailsMismatch = confirmEmailTrimmed.length > 0 && emailTrimmed !== confirmEmailTrimmed;

  const handleConfirmEmailChange = (val: string) => {
    setConfirmEmail(val);
    if (emailMismatch && val === email) {
      setEmailMismatch(false);
    }
  };

  const handleRegister = async () => {
    console.log('Register button pressed');
    console.log('Submitting registration with:', { firstName, lastName, email, county: selectedCounty });

    if (!email || !confirmEmail || !firstName || !lastName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (emailTrimmed !== confirmEmailTrimmed) {
      setEmailMismatch(true);
      return;
    }

    setEmailMismatch(false);
    setSubmitError(null);
    setLoading(true);

    const requestBody = {
      email: emailTrimmed,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      county: selectedCounty,
    };
    console.log('POST', `${BACKEND_URL}/api/users/register-client`);
    console.log('Request body:', JSON.stringify(requestBody));

    let data: any = {};
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/register-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);

      const text = await response.text();
      console.log('Raw response text:', text);

      try { data = JSON.parse(text); } catch { data = {}; }
      console.log('Parsed data:', JSON.stringify(data));

      if (response.ok) {
        console.log('Registration successful, navigating to /post-gig');
        const userPayload = data.user ?? data;
        setUser({
          id: userPayload.id ?? '',
          email: userPayload.email ?? emailTrimmed,
          userType: 'client',
          firstName: userPayload.firstName ?? firstName.trim(),
          lastName: userPayload.lastName ?? lastName.trim(),
          county: userPayload.county ?? selectedCounty,
        });
        router.replace('/post-gig');
        return;
      }

      const msg: string = data.error || data.message || `Registration failed (${response.status}). Please try again.`;
      console.log('Registration failed:', response.status, msg);
      setSubmitError(msg);
    } catch (networkErr: any) {
      console.log('Network error:', networkErr);
      setSubmitError('Unable to connect. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const confirmBorderColor = emailsMismatch ? '#FF3B30' : emailsMatch ? '#22c55e' : '#ddd';

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
        <View style={[styles.inputWrapper, { borderColor: confirmBorderColor }]}>
          <TextInput
            style={styles.inputInner}
            placeholder="Re-enter your email"
            value={confirmEmail}
            onChangeText={handleConfirmEmailChange}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {emailsMatch && (
            <Ionicons name="checkmark-circle" size={22} color="#22c55e" style={styles.inputIcon} />
          )}
          {emailsMismatch && (
            <Ionicons name="close-circle" size={22} color="#FF3B30" style={styles.inputIcon} />
          )}
        </View>
        {(emailsMismatch || emailMismatch) && (
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

        {submitError !== null && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#B71C1C" style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={styles.errorBannerText}>{submitError}</Text>
          </View>
        )}

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
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 10,
    backgroundColor: '#fafafa',
    paddingHorizontal: 14,
  },
  inputInner: {
    flex: 1, paddingVertical: 14, fontSize: 16, color: '#111',
  },
  inputIcon: { marginLeft: 8 },
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#EF9A9A',
    borderRadius: 10,
    padding: 12,
    marginTop: 20,
  },
  errorBannerText: { flex: 1, color: '#B71C1C', fontSize: 14, lineHeight: 20 },
});
