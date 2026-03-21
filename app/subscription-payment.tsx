
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageSourcePropType,
  ActivityIndicator,
  useColorScheme,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useUser } from '@/contexts/UserContext';

// Helper to resolve image sources (handles both local require() and remote URLs)
function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

// Normalize a phone number to 2547XXXXXXXX format (12 digits, no + prefix)
function formatMsisdn(phone: string): string {
  // Strip spaces, dashes, parentheses, and + characters
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  // Replace leading 0 with 254
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.slice(1);
  }
  // Already correct format
  return cleaned;
}

// Custom Modal for messages
function MessageModal({ visible, title, message, onClose, isError }: {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  isError?: boolean;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textColor = isDark ? colors.textDark : colors.text;
  const cardColor = isDark ? colors.cardDark : colors.card;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
          <View style={[styles.modalIconContainer, { backgroundColor: isError ? 'rgba(255, 59, 48, 0.1)' : 'rgba(52, 199, 89, 0.1)' }]}>
            <IconSymbol
              ios_icon_name={isError ? 'xmark.circle.fill' : 'checkmark.circle.fill'}
              android_material_icon_name={isError ? 'cancel' : 'check-circle'}
              size={48}
              color={isError ? '#FF3B30' : '#34C759'}
            />
          </View>
          <Text style={[styles.modalTitle, { color: textColor }]}>{title}</Text>
          <Text style={[styles.modalMessage, { color: textColor }]}>{message}</Text>
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: colors.primary }]}
            onPress={onClose}
          >
            <Text style={styles.modalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function SubscriptionPaymentScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { provider, setProvider } = useUser();

  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);

  console.log('Subscription payment screen loaded');

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const borderColor = isDark ? colors.borderDark : colors.border;

  const subscriptionAmount = 130;
  const merchantNumber = '8937121'; // Production go-live Short Code

  const showMessage = (title: string, message: string, error: boolean = false) => {
    setModalTitle(title);
    setModalMessage(message);
    setIsError(error);
    setModalVisible(true);
  };

  const handleSubscribe = async () => {
    console.log('Subscribe button pressed - initiating M-Pesa payment');

    if (!provider?.id) {
      showMessage('Error', 'Provider information not found. Please register again.', true);
      return;
    }

    // Get phone number from provider and normalize to 2547XXXXXXXX
    const rawPhone = provider.phoneNumber;
    if (!rawPhone) {
      showMessage('Error', 'Phone number not found. Please update your profile.', true);
      return;
    }

    const phoneNumber = formatMsisdn(rawPhone);
    console.log(`Phone formatted: ${rawPhone} -> ${phoneNumber}`);

    if (!/^2547\d{8}$/.test(phoneNumber)) {
      showMessage('Error', `Invalid phone number format (${phoneNumber}). Please use a Safaricom number starting with 07 or 2547.`, true);
      return;
    }

    setLoading(true);

    try {
      const { BACKEND_URL } = await import('@/utils/api');

      // Initiate M-Pesa STK Push using the correct endpoint
      const requestBody = {
        providerId: provider.id,
        phoneNumber: phoneNumber,
      };

      console.log('Sending M-Pesa payment request to /api/mpesa/initiate:', requestBody);

      const response = await fetch(`${BACKEND_URL}/api/mpesa/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('M-Pesa API error:', errorData);
        throw new Error(errorData.error || errorData.message || `Payment service error (${response.status}). Please try again.`);
      }

      const data = await response.json();
      console.log('M-Pesa payment response:', data);

      setLoading(false);

      if (data.checkoutRequestId) {
        // Store checkout request ID for status polling
        setCheckoutRequestId(data.checkoutRequestId);

        showMessage(
          'Payment Initiated',
          data.message || 'Please check your phone for the M-Pesa prompt. Enter your PIN to complete the payment.',
          false
        );

        // Poll for payment status
        pollPaymentStatus(data.checkoutRequestId);
      } else {
        showMessage('Payment Failed', 'Unable to process payment. Please try again.', true);
      }
    } catch (error) {
      console.error('Subscription payment error:', error);
      setLoading(false);

      let errorMessage = 'Failed to initiate payment. Please try again.';
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        errorMessage = 'No internet connection. Please check your network and try again.';
      } else if (error instanceof Error) {
        if (error.message && error.message !== 'Internal Server Error') {
          errorMessage = error.message;
        } else if (error.message === 'Internal Server Error') {
          errorMessage = 'Payment service is temporarily unavailable. Please try again later.';
        }
      }

      showMessage('Payment Error', errorMessage, true);
    }
  };

  const pollPaymentStatus = async (requestId: string) => {
    console.log('Polling payment status for:', requestId);
    
    try {
      const { BACKEND_URL } = await import('@/utils/api');
      
      // Poll every 3 seconds for up to 60 seconds
      let attempts = 0;
      const maxAttempts = 20;
      
      const pollInterval = setInterval(async () => {
        attempts++;
        
        try {
          const response = await fetch(`${BACKEND_URL}/api/mpesa/status/${requestId}`);
          
          if (response.ok) {
            const statusData = await response.json();
            console.log('Payment status:', statusData);
            
            if (statusData.status === 'completed') {
              clearInterval(pollInterval);
              
              // Update provider subscription status
              if (setProvider && provider) {
                setProvider({
                  ...provider,
                  subscriptionStatus: 'active',
                });
              }
              
              showMessage(
                'Payment Successful',
                'Your subscription is now active. Welcome to Nyota-KE!',
                false
              );
              
              // Navigate to Take-A-Gig screen
              setTimeout(() => {
                console.log('Navigating to Take-A-Gig screen');
                router.replace('/(tabs)/(home)');
              }, 2000);
            } else if (statusData.status === 'failed') {
              clearInterval(pollInterval);
              showMessage(
                'Payment Failed',
                statusData.resultDesc || 'Payment was not completed. Please try again.',
                true
              );
            }
          }
        } catch (pollError) {
          console.error('Error polling payment status:', pollError);
        }
        
        // Stop polling after max attempts
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          console.log('Payment status polling timed out');
        }
      }, 3000);
    } catch (error) {
      console.error('Error setting up payment polling:', error);
    }
  };

  const subscriptionAmountText = `KES ${subscriptionAmount}`;
  const merchantNumberText = `Merchant: ${merchantNumber}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={resolveImageSource(require('@/assets/images/5f49e934-ff57-4afc-8f25-a70466c61855.png'))}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={[styles.title, { color: textColor }]}>
            Monthly Subscription
          </Text>
          <Text style={[styles.subtitle, { color: textColor }]}>
            Subscribe to access gigs and grow your business
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.priceContainer}>
            <Text style={[styles.priceLabel, { color: textColor }]}>
              Subscription Fee
            </Text>
            <Text style={[styles.priceAmount, { color: colors.primary }]}>
              {subscriptionAmountText}
            </Text>
            <Text style={[styles.priceFrequency, { color: textColor }]}>
              per month
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: borderColor }]} />

          <View style={styles.benefitsContainer}>
            <Text style={[styles.benefitsTitle, { color: textColor }]}>
              What you get:
            </Text>

            <View style={styles.benefitItem}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={24}
                color="#34C759"
              />
              <Text style={[styles.benefitText, { color: textColor }]}>
                Access to all available gigs
              </Text>
            </View>

            <View style={styles.benefitItem}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={24}
                color="#34C759"
              />
              <Text style={[styles.benefitText, { color: textColor }]}>
                Direct client connections
              </Text>
            </View>

            <View style={styles.benefitItem}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={24}
                color="#34C759"
              />
              <Text style={[styles.benefitText, { color: textColor }]}>
                Profile visibility to clients
              </Text>
            </View>

            <View style={styles.benefitItem}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={24}
                color="#34C759"
              />
              <Text style={[styles.benefitText, { color: textColor }]}>
                Unlimited gig applications
              </Text>
            </View>

            <View style={styles.benefitItem}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={24}
                color="#34C759"
              />
              <Text style={[styles.benefitText, { color: textColor }]}>
                30-day access period
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: borderColor }]} />

          <View style={styles.paymentInfoContainer}>
            <View style={styles.mpesaLogoContainer}>
              <Text style={[styles.mpesaText, { color: textColor }]}>
                Pay with M-Pesa
              </Text>
            </View>

            <View style={styles.merchantInfo}>
              <IconSymbol
                ios_icon_name="building.2.fill"
                android_material_icon_name="store"
                size={20}
                color={textColor}
              />
              <Text style={[styles.merchantText, { color: textColor }]}>
                {merchantNumberText}
              </Text>
            </View>

            <View style={[styles.infoBox, { backgroundColor: isDark ? 'rgba(0, 122, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)' }]}>
              <IconSymbol
                ios_icon_name="info.circle.fill"
                android_material_icon_name="info"
                size={20}
                color="#007AFF"
              />
              <Text style={[styles.infoText, { color: textColor }]}>
                You will receive an M-Pesa prompt on your phone. Enter your PIN to complete the payment.
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.subscribeButton,
            { backgroundColor: colors.primary },
            loading && styles.subscribeButtonDisabled
          ]}
          onPress={handleSubscribe}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.subscribeButtonText}>Processing...</Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <IconSymbol
                ios_icon_name="creditcard.fill"
                android_material_icon_name="payment"
                size={24}
                color="#FFFFFF"
              />
              <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={[styles.renewalNotice, { backgroundColor: isDark ? 'rgba(255, 204, 0, 0.15)' : 'rgba(255, 204, 0, 0.1)' }]}>
          <IconSymbol
            ios_icon_name="arrow.clockwise.circle.fill"
            android_material_icon_name="refresh"
            size={20}
            color="#FFCC00"
          />
          <Text style={[styles.renewalText, { color: textColor }]}>
            Subscription renews every 30 days. You will be notified before renewal.
          </Text>
        </View>
      </ScrollView>

      <MessageModal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        onClose={() => setModalVisible(false)}
        isError={isError}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    marginBottom: 24,
  },
  priceContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  priceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  priceFrequency: {
    fontSize: 16,
    opacity: 0.7,
  },
  divider: {
    height: 1,
    marginVertical: 24,
  },
  benefitsContainer: {
    gap: 16,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: 16,
    flex: 1,
  },
  paymentInfoContainer: {
    gap: 16,
  },
  mpesaLogoContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  mpesaText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  merchantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  merchantText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  subscribeButton: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  renewalNotice: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  renewalText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.8,
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    minWidth: 120,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
