
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Platform,
  Image,
  ImageSourcePropType,
  Modal,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { useUser } from '@/contexts/UserContext';
import { SERVICE_CATEGORIES } from '@/constants/data';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiCall } from '@/utils/api';
import { IconSymbol } from '@/components/IconSymbol';

// Helper to resolve image sources (handles both local require() and remote URLs)
function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

// Custom Modal for errors (cross-platform compatible)
function ErrorModal({ visible, title, message, onClose }: { visible: boolean; title: string; message: string; onClose: () => void }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? colors.cardDark : colors.card;
  const textColor = isDark ? colors.textDark : colors.text;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.errorModalOverlay}>
        <View style={[styles.errorModalContent, { backgroundColor: bgColor }]}>
          <Text style={[styles.errorModalTitle, { color: colors.error }]}>{title}</Text>
          <Text style={[styles.errorModalMessage, { color: textColor }]}>{message}</Text>
          <TouchableOpacity
            style={[styles.errorModalButton, { backgroundColor: colors.primary }]}
            onPress={onClose}
          >
            <Text style={styles.errorModalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function PostGigScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useUser();

  const [category, setCategory] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
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
  const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });

  console.log('Post gig screen loaded');

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;
  const borderColor = isDark ? colors.borderDark : colors.border;
  const inputBg = isDark ? colors.cardDark : colors.card;

  const formatDate = (date: Date): string => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const dateDisplay = formatDate(serviceDate);
  const timeDisplay = formatTime(serviceTime);

  const showError = (title: string, message: string) => {
    setErrorModal({ visible: true, title, message });
  };

  const handlePostGig = async () => {
    console.log('Posting gig', { category, serviceDate, address, paymentOffer });

    if (!category) {
      showError('Error', 'Please select a service category');
      return;
    }

    if (!address || address.length > 30) {
      showError('Error', 'Address must be between 1 and 30 characters');
      return;
    }

    if (!description || description.length > 160) {
      showError('Error', 'Description must be between 1 and 160 characters');
      return;
    }

    const payment = parseInt(paymentOffer, 10);
    if (isNaN(payment) || payment < 1) {
      showError('Error', 'Please enter a valid payment amount');
      return;
    }

    const days = parseInt(durationDays, 10);
    const hours = parseInt(durationHours, 10);
    if (isNaN(days) || isNaN(hours) || (days === 0 && hours === 0)) {
      showError('Error', 'Duration must be at least 1 hour');
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

      const data = await apiCall<{ id: string }>('/api/gigs', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      console.log('Gig posted successfully:', data);
      setLoading(false);
      
      // Navigate to profile - the profile screen will fetch the most recent gig automatically
      // Using setTimeout to ensure state is fully updated before navigation
      setTimeout(() => {
        console.log('Navigating to profile after gig post');
        router.replace('/(tabs)/profile');
      }, 100);
    } catch (error) {
      console.error('Error posting gig:', error);
      setLoading(false);
      showError(
        'Error',
        error instanceof Error ? error.message : 'Failed to post gig. Please try again.'
      );
    }
  };

  const categoryPlaceholder = category || 'Select service category';

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
              source={resolveImageSource(require('@/assets/images/18ce84cd-4b0b-4bfa-85ca-98f529b1de37.png'))}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={[styles.label, { color: textColor }]}>Service Category</Text>
          <TouchableOpacity
            style={[styles.input, styles.selectInput, { backgroundColor: inputBg, borderColor }]}
            onPress={() => {
              console.log('Opening category modal');
              setShowCategoryModal(true);
            }}
          >
            <Text style={[styles.selectText, { color: category ? textColor : (isDark ? '#888' : '#999') }]}>
              {categoryPlaceholder}
            </Text>
            <IconSymbol
              ios_icon_name="chevron.down"
              android_material_icon_name="arrow-drop-down"
              size={24}
              color={textColor}
            />
          </TouchableOpacity>

          {/* Category Selection Modal */}
          <Modal
            visible={showCategoryModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowCategoryModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: bgColor }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: textColor }]}>Select Service Category</Text>
                  <TouchableOpacity
                    onPress={() => setShowCategoryModal(false)}
                    style={styles.closeButton}
                  >
                    <IconSymbol
                      ios_icon_name="xmark"
                      android_material_icon_name="close"
                      size={24}
                      color={textColor}
                    />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalScroll}>
                  {SERVICE_CATEGORIES.map((cat, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.categoryOption,
                        { borderBottomColor: borderColor },
                        category === cat && { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }
                      ]}
                      onPress={() => {
                        console.log('Category selected:', cat);
                        setCategory(cat);
                        setShowCategoryModal(false);
                      }}
                    >
                      <Text style={[styles.categoryText, { color: textColor }]}>
                        {cat}
                      </Text>
                      {category === cat && (
                        <IconSymbol
                          ios_icon_name="checkmark"
                          android_material_icon_name="check"
                          size={20}
                          color={primaryColor}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>

          <Text style={[styles.label, { color: textColor }]}>Service Date</Text>
          <TouchableOpacity
            style={[styles.input, styles.selectInput, { backgroundColor: inputBg, borderColor }]}
            onPress={() => {
              console.log('Opening date picker');
              setShowDatePicker(true);
            }}
          >
            <Text style={{ color: textColor }}>{dateDisplay}</Text>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={20}
              color={textColor}
            />
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

          <Text style={[styles.label, { color: textColor }]}>Service Time</Text>
          <TouchableOpacity
            style={[styles.input, styles.selectInput, { backgroundColor: inputBg, borderColor }]}
            onPress={() => {
              console.log('Opening time picker');
              setShowTimePicker(true);
            }}
          >
            <Text style={{ color: textColor }}>{timeDisplay}</Text>
            <IconSymbol
              ios_icon_name="clock"
              android_material_icon_name="access-time"
              size={20}
              color={textColor}
            />
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
            Address (max 30 characters)
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
            placeholder="Enter gig address"
            placeholderTextColor={isDark ? '#888' : '#999'}
            value={address}
            onChangeText={setAddress}
            maxLength={30}
          />

          <Text style={[styles.label, { color: textColor }]}>
            Description (max 160 characters)
          </Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: inputBg, color: textColor, borderColor }]}
            placeholder="Describe the work needed"
            placeholderTextColor={isDark ? '#888' : '#999'}
            value={description}
            onChangeText={setDescription}
            maxLength={160}
            multiline
            numberOfLines={4}
          />

          <View style={styles.durationRow}>
            <View style={styles.durationInput}>
              <Text style={[styles.label, { color: textColor }]}>Days</Text>
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
              <Text style={[styles.label, { color: textColor }]}>Hours</Text>
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

          <Text style={[styles.label, { color: textColor }]}>Preferred Gender (Optional)</Text>
          <View style={styles.genderRow}>
            <TouchableOpacity
              style={[
                styles.genderButton,
                { backgroundColor: inputBg, borderColor },
                preferredGender === 'male' && { backgroundColor: primaryColor, borderColor: primaryColor }
              ]}
              onPress={() => {
                console.log('Gender selected: Male');
                setPreferredGender('male');
              }}
            >
              <Text style={[
                styles.genderButtonText,
                { color: textColor },
                preferredGender === 'male' && { color: '#FFFFFF' }
              ]}>
                Male
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.genderButton,
                { backgroundColor: inputBg, borderColor },
                preferredGender === 'female' && { backgroundColor: primaryColor, borderColor: primaryColor }
              ]}
              onPress={() => {
                console.log('Gender selected: Female');
                setPreferredGender('female');
              }}
            >
              <Text style={[
                styles.genderButtonText,
                { color: textColor },
                preferredGender === 'female' && { color: '#FFFFFF' }
              ]}>
                Female
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.genderButton,
                { backgroundColor: inputBg, borderColor },
                preferredGender === 'any' && { backgroundColor: primaryColor, borderColor: primaryColor }
              ]}
              onPress={() => {
                console.log('Gender selected: Any');
                setPreferredGender('any');
              }}
            >
              <Text style={[
                styles.genderButtonText,
                { color: textColor },
                preferredGender === 'any' && { color: '#FFFFFF' }
              ]}>
                Any
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: textColor }]}>Payment Offer (KES)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
            placeholder="Enter amount in KES"
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

      {/* Error Modal */}
      <ErrorModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        onClose={() => setErrorModal({ visible: false, title: '', message: '' })}
      />
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
    gap: 12,
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 120,
    height: 120,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 16,
    flex: 1,
  },
  textArea: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 16,
  },
  durationInput: {
    flex: 1,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  genderButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  button: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  modalScroll: {
    maxHeight: 500,
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  categoryText: {
    fontSize: 16,
    flex: 1,
  },
  errorModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorModalContent: {
    width: '85%',
    padding: 24,
    borderRadius: 12,
    gap: 16,
  },
  errorModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorModalMessage: {
    fontSize: 16,
    textAlign: 'center',
  },
  errorModalButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorModalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
