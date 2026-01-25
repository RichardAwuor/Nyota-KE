
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { useUser } from '@/contexts/UserContext';
import { COUNTIES, County } from '@/constants/counties';
import { Picker } from '@react-native-picker/picker';

export default function RegisterClientScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { setUser } = useUser();

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organizationType, setOrganizationType] = useState<'individual' | 'organization'>('individual');
  const [organizationName, setOrganizationName] = useState('');
  const [selectedCounty, setSelectedCounty] = useState<County>(COUNTIES[46]); // Default to Nairobi
  const [loading, setLoading] = useState(false);

  console.log('Client registration screen loaded');

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const borderColor = isDark ? colors.borderDark : colors.border;
  const inputBg = isDark ? colors.cardDark : colors.card;

  const handleRegister = async () => {
    console.log('Client registration initiated', { email, firstName, lastName, organizationType });

    if (!email || !firstName || !lastName) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (organizationType === 'organization' && !organizationName) {
      Alert.alert('Error', 'Please enter your organization name');
      return;
    }

    setLoading(true);

    try {
      const { apiCall } = await import('@/utils/api');
      
      const requestBody = {
        email,
        firstName,
        lastName,
        county: selectedCounty.countyName,
        isOrganization: organizationType === 'organization',
        ...(organizationType === 'organization' && organizationName ? { organizationName } : {}),
      };

      console.log('Sending client registration request:', requestBody);

      const response = await apiCall('/api/users/register-client', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      console.log('Client registration response:', response);

      const registeredUser = {
        id: response.user.id,
        email: response.user.email,
        userType: response.user.userType as 'client',
        firstName: response.user.firstName,
        lastName: response.user.lastName,
        county: response.user.county,
        organizationName: organizationType === 'organization' ? organizationName : undefined,
      };

      setUser(registeredUser);
      console.log('Client registered successfully', registeredUser);
      setLoading(false);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Client registration error:', error);
      setLoading(false);
      Alert.alert(
        'Registration Failed',
        error instanceof Error ? error.message : 'Failed to register. Please try again.'
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: textColor }]}>Client Registration</Text>
          <Text style={[styles.subtitle, { color: textColor }]}>
            Create your account to post gigs
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: textColor }]}>Email *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
            placeholder="Enter your email"
            placeholderTextColor={isDark ? '#888' : '#999'}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, { color: textColor }]}>First Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
            placeholder="Enter your first name"
            placeholderTextColor={isDark ? '#888' : '#999'}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />

          <Text style={[styles.label, { color: textColor }]}>Last Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
            placeholder="Enter your last name"
            placeholderTextColor={isDark ? '#888' : '#999'}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />

          <Text style={[styles.label, { color: textColor }]}>Account Type *</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setOrganizationType('individual')}
            >
              <View style={[styles.radio, { borderColor }]}>
                {organizationType === 'individual' && (
                  <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />
                )}
              </View>
              <Text style={[styles.radioLabel, { color: textColor }]}>Individual</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setOrganizationType('organization')}
            >
              <View style={[styles.radio, { borderColor }]}>
                {organizationType === 'organization' && (
                  <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />
                )}
              </View>
              <Text style={[styles.radioLabel, { color: textColor }]}>Organization</Text>
            </TouchableOpacity>
          </View>

          {organizationType === 'organization' && (
            <>
              <Text style={[styles.label, { color: textColor }]}>Organization Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
                placeholder="Enter organization name"
                placeholderTextColor={isDark ? '#888' : '#999'}
                value={organizationName}
                onChangeText={setOrganizationName}
                autoCapitalize="words"
              />
            </>
          )}

          <Text style={[styles.label, { color: textColor }]}>County *</Text>
          <View style={[styles.pickerContainer, { backgroundColor: inputBg, borderColor }]}>
            <Picker
              selectedValue={selectedCounty.countyNumber}
              onValueChange={(value) => {
                const county = COUNTIES.find(c => c.countyNumber === value);
                if (county) {
                  setSelectedCounty(county);
                  console.log('County selected:', county.countyName);
                }
              }}
              style={[styles.picker, { color: textColor }]}
            >
              {COUNTIES.map((county) => (
                <Picker.Item
                  key={county.countyNumber}
                  label={`${county.countyName} (${county.countyCode})`}
                  value={county.countyNumber}
                />
              ))}
            </Picker>
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: primaryColor }]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 48 : 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: -8,
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 24,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  radioLabel: {
    fontSize: 16,
  },
  pickerContainer: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  button: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
