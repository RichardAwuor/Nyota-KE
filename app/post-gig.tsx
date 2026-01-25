
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
  Image,
  ImageSourcePropType,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { useUser } from '@/contexts/UserContext';
import { SERVICE_CATEGORIES } from '@/constants/data';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiCall } from '@/utils/api';

// Helper to resolve image sources (handles both local require() and remote URLs)
function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function PostGigScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useUser();

  const [category, setCategory] = useState(SERVICE_CATEGORIES[0]);
  const [serviceDate, setServiceDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [serviceTime, setServiceTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [durationDays, setDurationDays] = useState('0');
  const [durationHours, setDurationHours] = useState('1');
  const [paymentOffer, setPaymentOffer] = useState('');
  const [preferredGender, setPreferredGender] = useState<'any' | 'male' | 'female'>('any');
  const [loading, setLoading] = useState(false);

  console.log('Post gig screen loaded');

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;
  const borderColor = isDark ? colors.borderDark : colors.border;
  const inputBg = isDark ? colors.cardDark : colors.card;

  const formatDate = (date: Date): string => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const dateDisplay = formatDate(serviceDate);
  const timeDisplay = formatTime(serviceTime);

  const handlePostGig = async () => {
    console.log('Posting gig', { category, serviceDate, address, paymentOffer });

    if (!address || address.length > 30) {
      Alert.alert('Error', 'Address must be between 1 and 30 characters');
      return;
    }

    if (!description || description.length > 160) {
      Alert.alert('Error', 'Description must be between 1 and 160 characters');
      return;
    }

    const payment = parseInt(paymentOffer, 10);
    if (isNaN(payment) || payment < 1) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    const days = parseInt(durationDays, 10);
    const hours = parseInt(durationHours, 10);
    if (isNaN(days) || isNaN(hours) || (days === 0 && hours === 0)) {
      Alert.alert('Error', 'Duration must be at least 1 hour');
      return;
    }

    setLoading(true);

    try {
      if (!user?.id) {
        throw new Error('User not found. Please log in again.');
      }

      const requestBody = {
        clientId: user.id,
        category,
        serviceDate: serviceDate.toISOString(),
        serviceTime: timeDisplay,
        address,
        description,
        durationDays: days,
        durationHours: hours,
        paymentOffer: payment,
        ...(preferredGender !== 'any' ? { preferredGender: preferredGender.charAt(0).toUpperCase() + preferredGender.slice(1) } : {}),
      };

      console.log('Sending post gig request:', requestBody);

      const data = await apiCall('/api/gigs', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      console.log('Gig posted successfully:', data);
      setLoading(false);
      
      Alert.alert('Success', 'Your gig has been posted!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error posting gig:', error);
      setLoading(false);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to post gig. Please try again.'
      );
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Post a Gig',
          headerShown: true,
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoHeader}>
            <Image
              source={resolveImageSource(require('@/assets/images/209de818-f148-4db8-af50-74bbb0761bc7.png'))}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={[styles.label, { color: textColor }]}>Service Category *</Text>
          <View style={[styles.pickerContainer, { backgroundColor: inputBg, borderColor }]}>
            <Picker
              selectedValue={category}
              onValueChange={(value) => {
                setCategory(value);
                console.log('Category selected:', value);
              }}
              style={[styles.picker, { color: textColor }]}
            >
              {SERVICE_CATEGORIES.map((cat) => (
                <Picker.Item key={cat} label={cat} value={cat} />
              ))}
            </Picker>
          </View>

          <Text style={[styles.label, { color: textColor }]}>Service Date *</Text>
          <TouchableOpacity
            style={[styles.input, { backgroundColor: inputBg, borderColor, justifyContent: 'center' }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: textColor }}>{dateDisplay}</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={serviceDate}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setServiceDate(selectedDate);
                  console.log('Service date selected:', selectedDate);
                }
              }}
              minimumDate={new Date()}
            />
          )}

          <Text style={[styles.label, { color: textColor }]}>Service Time *</Text>
          <TouchableOpacity
            style={[styles.input, { backgroundColor: inputBg, borderColor, justifyContent: 'center' }]}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={{ color: textColor }}>{timeDisplay}</Text>
          </TouchableOpacity>

          {showTimePicker && (
            <DateTimePicker
              value={serviceTime}
              mode="time"
              display="default"
              onChange={(event, selectedTime) => {
                setShowTimePicker(false);
                if (selectedTime) {
                  setServiceTime(selectedTime);
                  console.log('Service time selected:', selectedTime);
                }
              }}
            />
          )}

          <Text style={[styles.label, { color: textColor }]}>
            Gig Address * (max 30 characters)
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
            placeholder="e.g., Westlands, Nairobi"
            placeholderTextColor={isDark ? '#888' : '#999'}
            value={address}
            onChangeText={setAddress}
            maxLength={30}
          />
          <Text style={[styles.charCount, { color: textColor }]}>
            {address.length}/30
          </Text>

          <Text style={[styles.label, { color: textColor }]}>
            Gig Description * (max 160 characters)
          </Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: inputBg, color: textColor, borderColor }]}
            placeholder="Describe the work needed..."
            placeholderTextColor={isDark ? '#888' : '#999'}
            value={description}
            onChangeText={setDescription}
            maxLength={160}
            multiline
            numberOfLines={4}
          />
          <Text style={[styles.charCount, { color: textColor }]}>
            {description.length}/160
          </Text>

          <Text style={[styles.label, { color: textColor }]}>Duration *</Text>
          <View style={styles.durationRow}>
            <View style={styles.durationInput}>
              <Text style={[styles.durationLabel, { color: textColor }]}>Days</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
                placeholder="0"
                placeholderTextColor={isDark ? '#888' : '#999'}
                value={durationDays}
                onChangeText={setDurationDays}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.durationInput}>
              <Text style={[styles.durationLabel, { color: textColor }]}>Hours</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
                placeholder="1"
                placeholderTextColor={isDark ? '#888' : '#999'}
                value={durationHours}
                onChangeText={setDurationHours}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Text style={[styles.label, { color: textColor }]}>Preferred Gender (optional)</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setPreferredGender('any')}
            >
              <View style={[styles.radio, { borderColor }]}>
                {preferredGender === 'any' && (
                  <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />
                )}
              </View>
              <Text style={[styles.radioLabel, { color: textColor }]}>Any</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setPreferredGender('male')}
            >
              <View style={[styles.radio, { borderColor }]}>
                {preferredGender === 'male' && (
                  <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />
                )}
              </View>
              <Text style={[styles.radioLabel, { color: textColor }]}>Male</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setPreferredGender('female')}
            >
              <View style={[styles.radio, { borderColor }]}>
                {preferredGender === 'female' && (
                  <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />
                )}
              </View>
              <Text style={[styles.radioLabel, { color: textColor }]}>Female</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: textColor }]}>Payment Offer (KES) *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
            placeholder="e.g., 5000"
            placeholderTextColor={isDark ? '#888' : '#999'}
            value={paymentOffer}
            onChangeText={setPaymentOffer}
            keyboardType="number-pad"
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: primaryColor }]}
            onPress={handlePostGig}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Posting...' : 'Post Gig'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </>
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
    gap: 16,
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 60,
    height: 60,
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
  textArea: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: -8,
    opacity: 0.6,
  },
  pickerContainer: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 16,
  },
  durationInput: {
    flex: 1,
  },
  durationLabel: {
    fontSize: 14,
    marginBottom: 4,
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
