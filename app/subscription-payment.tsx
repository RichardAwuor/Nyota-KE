
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { useUser } from '@/contexts/UserContext';
import { IconSymbol } from '@/components/IconSymbol';
import { apiCall, BACKEND_URL } from '@/utils/api';

export default function SubscriptionPaymentScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, provider, setProvider } = useUser();

  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [checkoutRequestId, setCheckoutRequestId] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);

  console.log('Subscription payment screen loaded');

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const accentColor = isDark ? colors.accentDark : colors.accent;



  const formatPhoneNumber = (phone: string) => {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
      return '254' + cleaned.substring(1);
    }
    
    // If starts with +254, remove the +
    if (cleaned.startsWith('254')) {
      return cleaned;
    }
    
    // If starts with 7 or 1, add 254
    if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      return '254' + cleaned;
    }
    
    return cleaned;
  };

  const validatePhoneNumber = (phone: string) => {
    const formatted = formatPhoneNumber(phone);
    // Kenyan phone numbers: 254XXXXXXXXX (12 digits total)
    return formatted.length === 12 && formatted.startsWith('254');
  };

  const handlePayment = async () => {
    console.log('Initiating M-Pesa payment for provider:', provider?.id);

    if (!provider || !user) {
      Alert.alert('Error', 'User information not found');
      return;
    }

    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your M-Pesa phone number');
      return;
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert(
        'Invalid Phone Number',
        'Please enter a valid Kenyan phone number (e.g., 0712345678 or 254712345678)'
      );
      return;
    }

    setLoading(true);

    try {
      console.log('Sending payment request to backend:', {
        providerId: provider.id,
        phoneNumber: formattedPhone,
      });

      const data = await apiCall('/api/mpesa/initiate', {
        method: 'POST',
        body: JSON.stringify({
          providerId: provider.id,
          phoneNumber: formattedPhone,
        }),
      });

      console.log('Payment initiation response:', data);

      if (data.checkoutRequestId) {
        setCheckoutRequestId(data.checkoutRequestId);
      }

      setLoading(false);

      Alert.alert(
        'Payment Initiated',
        data.message || 'Please check your phone for the M-Pesa prompt to complete payment of KES 130',
        [
          {
            text: 'Check Status',
            onPress: () => {
              if (data.checkoutRequestId) {
                checkPaymentStatus(data.checkoutRequestId);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Payment initiation error:', error);
      setLoading(false);
      Alert.alert(
        'Payment Failed',
        error instanceof Error ? error.message : 'Failed to initiate payment. Please try again.'
      );
    }
  };

  const checkPaymentStatus = async (requestId: string) => {
    if (!requestId) {
      Alert.alert('Error', 'No payment request to check');
      return;
    }

    setCheckingStatus(true);
    console.log('Checking payment status for:', requestId);

    try {
      const data = await apiCall(`/api/mpesa/status/${requestId}`, {
        method: 'GET',
      });

      console.log('Payment status response:', data);

      setCheckingStatus(false);

      const statusText = data.status || 'unknown';
      
      if (statusText === 'completed') {
        // Update provider subscription status
        if (provider) {
          setProvider({
            ...provider,
            subscriptionStatus: 'active',
          });
        }

        Alert.alert(
          'Payment Successful',
          `Your subscription is now active! Receipt: ${data.mpesaReceiptNumber || 'N/A'}`,
          [
            {
              text: 'Continue',
              onPress: () => {
                console.log('Payment completed, navigating to home');
                router.replace('/(tabs)');
              },
            },
          ]
        );
      } else if (statusText === 'failed') {
        Alert.alert(
          'Payment Failed',
          data.resultDesc || 'The payment was not successful. Please try again.'
        );
      } else if (statusText === 'pending') {
        Alert.alert(
          'Payment Pending',
          'The payment is still being processed. Please complete the M-Pesa prompt on your phone.',
          [
            {
              text: 'Check Again',
              onPress: () => checkPaymentStatus(requestId),
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]
        );
      } else {
        Alert.alert('Unknown Status', `Payment status: ${statusText}`);
      }
    } catch (error) {
      console.error('Status check error:', error);
      setCheckingStatus(false);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to check payment status'
      );
    }
  };

  const handleSkip = () => {
    console.log('User skipped payment');
    Alert.alert(
      'Skip Payment',
      'You need an active subscription to view and accept gigs. You can subscribe later from your profile.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Skip Anyway',
          onPress: () => {
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: accentColor }]}>
          <IconSymbol
            ios_icon_name="creditcard"
            android_material_icon_name="payment"
            size={64}
            color="#FFFFFF"
          />
        </View>

        <Text style={[styles.title, { color: textColor }]}>Subscription Required</Text>
        
        <Text style={[styles.description, { color: textColor }]}>
          To access gigs and start earning, you need an active subscription.
        </Text>

        <View style={[styles.priceCard, { backgroundColor: cardColor }]}>
          <Text style={[styles.priceLabel, { color: textColor }]}>Monthly Subscription</Text>
          <Text style={[styles.price, { color: primaryColor }]}>KES 130</Text>
          <Text style={[styles.priceNote, { color: textColor }]}>
            Renews automatically every 30 days
          </Text>
        </View>

        <View style={styles.features}>
          <View style={styles.featureItem}>
            <IconSymbol
              ios_icon_name="checkmark.circle"
              android_material_icon_name="check-circle"
              size={24}
              color={primaryColor}
            />
            <Text style={[styles.featureText, { color: textColor }]}>
              Access to all available gigs
            </Text>
          </View>

          <View style={styles.featureItem}>
            <IconSymbol
              ios_icon_name="checkmark.circle"
              android_material_icon_name="check-circle"
              size={24}
              color={primaryColor}
            />
            <Text style={[styles.featureText, { color: textColor }]}>
              Accept unlimited gigs
            </Text>
          </View>

          <View style={styles.featureItem}>
            <IconSymbol
              ios_icon_name="checkmark.circle"
              android_material_icon_name="check-circle"
              size={24}
              color={primaryColor}
            />
            <Text style={[styles.featureText, { color: textColor }]}>
              Build your reputation with reviews
            </Text>
          </View>

          <View style={styles.featureItem}>
            <IconSymbol
              ios_icon_name="checkmark.circle"
              android_material_icon_name="check-circle"
              size={24}
              color={primaryColor}
            />
            <Text style={[styles.featureText, { color: textColor }]}>
              Direct client communication
            </Text>
          </View>
        </View>

        <View style={[styles.inputContainer, { backgroundColor: cardColor }]}>
          <IconSymbol
            ios_icon_name="phone"
            android_material_icon_name="phone"
            size={20}
            color={textColor}
          />
          <TextInput
            style={[styles.input, { color: textColor }]}
            placeholder="M-Pesa Phone Number (e.g., 0712345678)"
            placeholderTextColor={isDark ? '#888' : '#999'}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            maxLength={15}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: primaryColor }]}
          onPress={handlePayment}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Pay with M-Pesa</Text>
          )}
        </TouchableOpacity>

        {checkoutRequestId && (
          <TouchableOpacity
            style={[styles.statusButton, { borderColor: primaryColor }]}
            onPress={() => checkPaymentStatus(checkoutRequestId)}
            disabled={checkingStatus}
          >
            {checkingStatus ? (
              <ActivityIndicator color={primaryColor} />
            ) : (
              <Text style={[styles.statusButtonText, { color: primaryColor }]}>
                Check Payment Status
              </Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={[styles.skipText, { color: textColor }]}>Skip for now</Text>
        </TouchableOpacity>

        <Text style={[styles.merchantInfo, { color: textColor }]}>
          Merchant: NO-COLLAR (6803513)
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.8,
  },
  priceCard: {
    width: '100%',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  priceLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  price: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  priceNote: {
    fontSize: 14,
    opacity: 0.7,
  },
  features: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    flex: 1,
  },
  inputContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  button: {
    width: '100%',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statusButton: {
    width: '100%',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
  },
  statusButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    padding: 12,
    marginBottom: 24,
  },
  skipText: {
    fontSize: 16,
    opacity: 0.7,
  },
  merchantInfo: {
    fontSize: 12,
    opacity: 0.5,
  },
});
