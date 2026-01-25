
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
import DateTimePicker from '@react-native-community/datetimepicker';

export default function RegisterProviderScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { setUser, setProvider } = useUser();

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [dateOfBirth, setDateOfBirth] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [identityNumber, setIdentityNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCounty, setSelectedCounty] = useState<County>(COUNTIES[46]); // Default to Nairobi
  const [commuteDistance, setCommuteDistance] = useState('20');
  const [loading, setLoading] = useState(false);

  console.log('Provider registration screen loaded');

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const borderColor = isDark ? colors.borderDark : colors.border;
  const inputBg = isDark ? colors.cardDark : colors.card;

  const formatDate = (date: Date): string => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const dateDisplay = formatDate(dateOfBirth);

  const handleRegister = async () => {
    console.log('Provider registration initiated', { email, firstName, lastName, gender });

    if (!email || !firstName || !lastName || !identityNumber || !phoneNumber) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    const distance = parseInt(commuteDistance, 10);
    if (isNaN(distance) || distance < 1 || distance > 100) {
      Alert.alert('Error', 'Commute distance must be between 1 and 100 KMs');
      return;
    }

    setLoading(true);

    try {
      const { apiCall } = await import('@/utils/api');
      
      // Format date as YYYY-MM-DD for the API
      const formattedDate = dateOfBirth.toISOString().split('T')[0];
      
      const requestBody = {
        email,
        firstName,
        lastName,
        gender: gender.charAt(0).toUpperCase() + gender.slice(1), // Capitalize first letter
        dateOfBirth: formattedDate,
        identityNumber,
        county: selectedCounty.countyName,
        commuteDistance: distance,
        phoneNumber,
        services: [], // Empty array for now - can be added later
        training: [], // Empty array for now - can be added later
      };

      console.log('Sending provider registration request:', requestBody);

      const response = await apiCall('/api/users/register-provider', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      console.log('Provider registration response:', response);

      const registeredUser = {
        id: response.user.id,
        email: response.user.email,
        userType: response.user.userType as 'provider',
        firstName,
        lastName,
        county: selectedCounty.countyName,
      };

      const registeredProvider = {
        id: response.provider.id,
        providerCode: response.provider.providerCode,
        gender,
        phoneNumber,
        subscriptionStatus: 'inactive' as const,
        photoUrl: '',
      };

      setUser(registeredUser);
      setProvider(registeredProvider);
      console.log('Provider registered successfully', { user: registeredUser, provider: registeredProvider });
      setLoading(false);
      
      // Navigate to subscription payment
      router.push('/subscription-payment');
    } catch (error) {
      console.error('Provider registration error:', error);
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
          <Text style={[styles.title, { color: textColor }]}>Provider Registration</Text>
          <Text style={[styles.subtitle, { color: textColor }]}>
            Create your account to find gigs
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

          <Text style={[styles.label, { color: textColor }]}>Gender *</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setGender('male')}
            >
              <View style={[styles.radio, { borderColor }]}>
                {gender === 'male' && (
                  <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />
                )}
              </View>
              <Text style={[styles.radioLabel, { color: textColor }]}>Male</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setGender('female')}
            >
              <View style={[styles.radio, { borderColor }]}>
                {gender === 'female' && (
                  <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />
                )}
              </View>
              <Text style={[styles.radioLabel, { color: textColor }]}>Female</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: textColor }]}>Date of Birth *</Text>
          <TouchableOpacity
            style={[styles.input, { backgroundColor: inputBg, borderColor, justifyContent: 'center' }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: textColor }}>{dateDisplay}</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={dateOfBirth}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setDateOfBirth(selectedDate);
                  console.log('Date of birth selected:', selectedDate);
                }
              }}
              maximumDate={new Date()}
            />
          )}

          <Text style={[styles.label, { color: textColor }]}>Identity Number *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
            placeholder="Enter your ID number"
            placeholderTextColor={isDark ? '#888' : '#999'}
            value={identityNumber}
            onChangeText={setIdentityNumber}
            keyboardType="number-pad"
          />

          <Text style={[styles.label, { color: textColor }]}>Phone Number *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
            placeholder="e.g., 0712345678"
            placeholderTextColor={isDark ? '#888' : '#999'}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />

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

          <Text style={[styles.label, { color: textColor }]}>
            Preferred Commute Distance (KMs) *
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
            placeholder="Max 100 KMs"
            placeholderTextColor={isDark ? '#888' : '#999'}
            value={commuteDistance}
            onChangeText={setCommuteDistance}
            keyboardType="number-pad"
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: primaryColor }]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating Account...' : 'Continue to Payment'}
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
