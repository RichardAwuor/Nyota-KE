
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@/contexts/UserContext';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { SERVICE_CATEGORIES } from '@/constants/data';
import { apiCall, BACKEND_URL } from '@/utils/api';

// Helper to resolve image sources (handles both local require() and remote URLs)
function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function HomeScreen() {
  const { user, provider } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;
  const borderColor = isDark ? colors.borderDark : colors.border;
  const inputBg = isDark ? colors.cardDark : colors.card;

  const isClient = user?.userType === 'client';
  const isProvider = user?.userType === 'provider';

  // Client state - Post a Gig
  const [category, setCategory] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [serviceTime, setServiceTime] = useState('09:00');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [durationDays, setDurationDays] = useState('0');
  const [durationHours, setDurationHours] = useState('1');
  const [preferredGender, setPreferredGender] = useState('');
  const [paymentOffer, setPaymentOffer] = useState('');

  // Provider state - Available Gigs
  const [availableGigs, setAvailableGigs] = useState<any[]>([]);
  const [loadingGigs, setLoadingGigs] = useState(false);
  const [postingGig, setPostingGig] = useState(false);

  // Fetch available gigs for providers
  const fetchAvailableGigs = useCallback(async () => {
    if (!provider?.id) return;

    setLoadingGigs(true);
    try {
      console.log('Fetching available gigs for provider:', provider.id);
      const data = await apiCall(`/api/gigs/matches/${provider.id}`, {
        method: 'GET',
      });
      console.log('Available gigs response:', data);
      setAvailableGigs(data);
    } catch (error) {
      console.error('Error fetching gigs:', error);
    } finally {
      setLoadingGigs(false);
    }
  }, [provider?.id]);

  useEffect(() => {
    if (isProvider && provider?.id && provider?.subscriptionStatus === 'active') {
      fetchAvailableGigs();
    }
  }, [isProvider, provider?.id, provider?.subscriptionStatus, fetchAvailableGigs]);

  const handlePostGig = async () => {
    console.log('Posting gig', {
      category,
      serviceDate,
      serviceTime,
      address,
      description,
      durationDays,
      durationHours,
      preferredGender,
      paymentOffer,
    });

    if (!category || !address || !description || !paymentOffer) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not found. Please log in again.');
      return;
    }

    setPostingGig(true);

    try {
      const requestBody = {
        clientId: user.id,
        category,
        serviceDate: serviceDate.toISOString(),
        serviceTime,
        address,
        description,
        durationDays: parseInt(durationDays, 10),
        durationHours: parseInt(durationHours, 10),
        paymentOffer: parseInt(paymentOffer, 10),
        ...(preferredGender ? { preferredGender } : {}),
      };

      console.log('Sending post gig request:', requestBody);

      const data = await apiCall('/api/gigs', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      console.log('Post gig response:', data);

      Alert.alert('Success', 'Gig posted successfully!');
      
      // Reset form
      setCategory('');
      setServiceDate(new Date());
      setServiceTime('09:00');
      setAddress('');
      setDescription('');
      setDurationDays('0');
      setDurationHours('1');
      setPreferredGender('');
      setPaymentOffer('');
    } catch (error) {
      console.error('Error posting gig:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to post gig. Please try again.');
    } finally {
      setPostingGig(false);
    }
  };

  const handleAcceptGig = async (gigId: string) => {
    console.log('Accepting gig', gigId);

    if (!provider?.id) {
      Alert.alert('Error', 'Provider not found. Please log in again.');
      return;
    }

    try {
      const data = await apiCall(`/api/gigs/${gigId}/accept`, {
        method: 'PUT',
        body: JSON.stringify({ providerId: provider.id }),
      });

      console.log('Accept gig response:', data);

      Alert.alert('Success', 'Gig accepted successfully!');
      
      // Refresh available gigs
      fetchAvailableGigs();
    } catch (error) {
      console.error('Error accepting gig:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to accept gig. Please try again.');
    }
  };

  const dateString = serviceDate.toLocaleDateString();

  if (isClient) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoHeader}>
            <Image
              source={resolveImageSource(require('@/assets/images/209de818-f148-4db8-af50-74bbb0761bc7.png'))}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor }]}>Post a Gig</Text>
            <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
              Find the right service provider
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: textColor }]}>Service Category</Text>
            <View style={[styles.pickerContainer, { backgroundColor: inputBg, borderColor }]}>
              <Picker
                selectedValue={category}
                onValueChange={(value) => setCategory(value)}
                style={[styles.picker, { color: textColor }]}
              >
                <Picker.Item label="Select Category" value="" />
                {SERVICE_CATEGORIES.map((cat) => (
                  <Picker.Item key={cat} label={cat} value={cat} />
                ))}
              </Picker>
            </View>

            <Text style={[styles.label, { color: textColor }]}>Service Date</Text>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: inputBg, borderColor, justifyContent: 'center' }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: textColor }}>{dateString}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={serviceDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setServiceDate(selectedDate);
                  }
                }}
                minimumDate={new Date()}
              />
            )}

            <Text style={[styles.label, { color: textColor }]}>Service Time</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
              placeholder="e.g., 09:00"
              placeholderTextColor={textSecondaryColor}
              value={serviceTime}
              onChangeText={setServiceTime}
            />

            <Text style={[styles.label, { color: textColor }]}>Address (max 30 characters)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
              placeholder="Enter gig address"
              placeholderTextColor={textSecondaryColor}
              value={address}
              onChangeText={setAddress}
              maxLength={30}
            />

            <Text style={[styles.label, { color: textColor }]}>Description (max 160 characters)</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: inputBg, color: textColor, borderColor }]}
              placeholder="Describe the work needed"
              placeholderTextColor={textSecondaryColor}
              value={description}
              onChangeText={setDescription}
              maxLength={160}
              multiline
              numberOfLines={4}
            />

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={[styles.label, { color: textColor }]}>Days</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
                  placeholder="0"
                  placeholderTextColor={textSecondaryColor}
                  value={durationDays}
                  onChangeText={setDurationDays}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.halfWidth}>
                <Text style={[styles.label, { color: textColor }]}>Hours</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
                  placeholder="1"
                  placeholderTextColor={textSecondaryColor}
                  value={durationHours}
                  onChangeText={setDurationHours}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={[styles.label, { color: textColor }]}>Preferred Gender (Optional)</Text>
            <View style={[styles.pickerContainer, { backgroundColor: inputBg, borderColor }]}>
              <Picker
                selectedValue={preferredGender}
                onValueChange={(value) => setPreferredGender(value)}
                style={[styles.picker, { color: textColor }]}
              >
                <Picker.Item label="No Preference" value="" />
                <Picker.Item label="Male" value="Male" />
                <Picker.Item label="Female" value="Female" />
              </Picker>
            </View>

            <Text style={[styles.label, { color: textColor }]}>Payment Offer (KES)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
              placeholder="Enter amount in KES"
              placeholderTextColor={textSecondaryColor}
              value={paymentOffer}
              onChangeText={setPaymentOffer}
              keyboardType="number-pad"
            />

            <TouchableOpacity
              style={[styles.button, { backgroundColor: primaryColor }]}
              onPress={handlePostGig}
              disabled={postingGig}
            >
              {postingGig ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Post Gig</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isProvider) {
    const needsSubscription = provider?.subscriptionStatus === 'expired';

    if (needsSubscription) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
          <View style={styles.centerContent}>
            <IconSymbol
              ios_icon_name="exclamationmark.circle.fill"
              android_material_icon_name="error"
              size={64}
              color={colors.warning}
            />
            <Text style={[styles.title, { color: textColor, textAlign: 'center', marginTop: 16 }]}>
              Subscription Required
            </Text>
            <Text style={[styles.subtitle, { color: textSecondaryColor, textAlign: 'center', marginTop: 8 }]}>
              Subscribe for KES 130/month to access gigs
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: primaryColor, marginTop: 24 }]}
              onPress={() => router.push('/subscription-payment')}
            >
              <Text style={styles.buttonText}>Subscribe Now</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoHeader}>
            <Image
              source={resolveImageSource(require('@/assets/images/209de818-f148-4db8-af50-74bbb0761bc7.png'))}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor }]}>Available Gigs</Text>
            <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
              Gigs matching your profile
            </Text>
          </View>

          {loadingGigs ? (
            <View style={[styles.card, { backgroundColor: cardColor }]}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={[styles.emptyText, { color: textSecondaryColor, marginTop: 16 }]}>
                Loading available gigs...
              </Text>
            </View>
          ) : availableGigs.length === 0 ? (
            <View style={[styles.card, { backgroundColor: cardColor }]}>
              <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                No gigs available at the moment. Check back soon!
              </Text>
            </View>
          ) : (
            <React.Fragment>
              {availableGigs.map((gig) => {
                const gigDate = new Date(gig.serviceDate);
                const formattedDate = gigDate.toLocaleDateString();
                const duration = `${gig.durationDays}d ${gig.durationHours}h`;
                
                return (
                  <View key={gig.id} style={[styles.card, { backgroundColor: cardColor }]}>
                    <Text style={[styles.gigCategory, { color: primaryColor }]}>{gig.category}</Text>
                    <Text style={[styles.gigDescription, { color: textColor }]}>{gig.description}</Text>
                    <View style={styles.gigDetails}>
                      <Text style={[styles.gigDetailText, { color: textSecondaryColor }]}>
                        📍 {gig.address}
                      </Text>
                      <Text style={[styles.gigDetailText, { color: textSecondaryColor }]}>
                        📅 {formattedDate}
                      </Text>
                    </View>
                    <View style={styles.gigDetails}>
                      <Text style={[styles.gigDetailText, { color: textSecondaryColor }]}>
                        ⏱️ {duration}
                      </Text>
                      <Text style={[styles.gigDetailText, { color: textSecondaryColor }]}>
                        🕐 {gig.serviceTime}
                      </Text>
                    </View>
                    <Text style={[styles.gigPayment, { color: colors.success }]}>
                      KES {gig.paymentOffer.toLocaleString()}
                    </Text>
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: primaryColor, marginTop: 12 }]}
                      onPress={() => handleAcceptGig(gig.id)}
                    >
                      <Text style={styles.buttonText}>Accept Gig</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </React.Fragment>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 60,
    height: 60,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
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
  pickerContainer: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
  },
  gigCategory: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  gigDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  gigDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gigDetailText: {
    fontSize: 12,
  },
  gigPayment: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
