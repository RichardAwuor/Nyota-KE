
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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { useUser } from '@/contexts/UserContext';
import { IconSymbol } from '@/components/IconSymbol';
import { apiCall, BACKEND_URL } from '@/utils/api';

// Custom Modal Component for cross-platform compatibility
function ConfirmModal({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  showCancel = true,
}: {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.container, { backgroundColor: bgColor }]}>
          <Text style={[modalStyles.title, { color: textColor }]}>{title}</Text>
          <Text style={[modalStyles.message, { color: textColor }]}>{message}</Text>
          <View style={modalStyles.buttons}>
            {showCancel && onCancel && (
              <TouchableOpacity
                style={[modalStyles.button, modalStyles.cancelButton]}
                onPress={onCancel}
              >
                <Text style={[modalStyles.buttonText, { color: textColor }]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[modalStyles.button, { backgroundColor: primaryColor }]}
              onPress={onConfirm}
            >
              <Text style={[modalStyles.buttonText, { color: '#FFFFFF' }]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function SubscriptionPaymentScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, provider, setProvider } = useUser();

  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [checkoutRequestId, setCheckoutRequestId] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalOnConfirm, setModalOnConfirm] = useState<() => void>(() => () => {});
  const [modalOnCancel, setModalOnCancel] = useState<(() => void) | undefined>(undefined);
  const [modalShowCancel, setModalShowCancel] = useState(true);
  const [modalConfirmText, setModalConfirmText] = useState('OK');

  console.log('Subscription payment screen loaded');

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const accentColor = isDark ? colors.accentDark : colors.accent;

  const showModal = (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      onCancel?: () => void;
      showCancel?: boolean;
      confirmText?: string;
    }
  ) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalOnConfirm(() => onConfirm);
    setModalOnCancel(options?.onCancel ? () => options.onCancel : undefined);
    setModalShowCancel(options?.showCancel ?? true);
    setModalConfirmText(options?.confirmText || 'OK');
    setModalVisible(true);
  };



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
      showModal('Error', 'User information not found', () => setModalVisible(false), {
        showCancel: false,
      });
      return;
    }

    if (!phoneNumber.trim()) {
      showModal('Error', 'Please enter your M-Pesa phone number', () => setModalVisible(false), {
        showCancel: false,
      });
      return;
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    if (!validatePhoneNumber(phoneNumber)) {
      showModal(
        'Invalid Phone Number',
        'Please enter a valid Kenyan phone number (e.g., 0712345678 or 254712345678)',
        () => setModalVisible(false),
        {
          showCancel: false,
        }
      );
      return;
    }

    setLoading(true);

    try {
      console.log('=== M-Pesa Payment Initiation ===');
      console.log('Provider ID:', provider.id);
      console.log('Phone Number (formatted):', formattedPhone);
      console.log('Amount: KES 130');
      console.log('Merchant: Collarless (6803513)');

      const response = await fetch(`${BACKEND_URL}/api/mpesa/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerId: provider.id,
          phoneNumber: formattedPhone,
        }),
      });

      console.log('=== M-Pesa API Response ===');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);

      const data = await response.json();
      console.log('Response Data:', data);

      if (!response.ok) {
        // Handle error response from backend
        const errorMsg = data.error || data.message || `API request failed with status ${response.status}`;
        console.error('=== M-Pesa API Error ===');
        console.error('Error:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('=== Payment Response ===');
      console.log('Success:', !!data.checkoutRequestId);
      console.log('Checkout Request ID:', data.checkoutRequestId);
      console.log('Message:', data.message);

      if (data.checkoutRequestId) {
        setCheckoutRequestId(data.checkoutRequestId);
      }

      setLoading(false);

      showModal(
        'Payment Initiated',
        data.message || 'Please check your phone for the M-Pesa prompt to complete payment of KES 130. Enter your M-Pesa PIN to confirm.',
        () => {
          setModalVisible(false);
          if (data.checkoutRequestId) {
            checkPaymentStatus(data.checkoutRequestId);
          }
        },
        {
          confirmText: 'Check Status',
          showCancel: false,
        }
      );
    } catch (error: any) {
      console.error('=== Payment Error ===');
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error?.message);
      console.error('Error details:', error);
      
      setLoading(false);
      
      let errorMessage = error?.message || 'Failed to initiate payment. Please try again.';
      
      // Check if it's a configuration error
      if (errorMessage.includes('configuration incomplete') || errorMessage.includes('contact support')) {
        showModal(
          'Payment System Unavailable',
          'The M-Pesa payment system is currently being configured. Please contact Collarless support or try again later.',
          () => setModalVisible(false),
          {
            showCancel: false,
          }
        );
      } else {
        // Display the exact error from the backend/M-Pesa
        showModal('Payment Failed', errorMessage, () => setModalVisible(false), {
          showCancel: false,
        });
      }
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

        const receiptText = data.mpesaReceiptNumber 
          ? `Receipt: ${data.mpesaReceiptNumber}` 
          : '';
        
        showModal(
          'Payment Successful! 🎉',
          `Your subscription is now active! ${receiptText}\n\nYou can now view and accept gigs.`,
          () => {
            setModalVisible(false);
            console.log('Payment completed, navigating to Take-A-Gig screen');
            router.replace('/(tabs)');
          },
          {
            confirmText: 'Continue to Gigs',
            showCancel: false,
          }
        );
      } else if (statusText === 'failed') {
        showModal(
          'Payment Failed',
          data.resultDesc || 'The payment was not successful. Please try again.',
          () => setModalVisible(false),
          {
            showCancel: false,
          }
        );
      } else if (statusText === 'pending') {
        showModal(
          'Payment Pending',
          'The payment is still being processed. Please complete the M-Pesa prompt on your phone and enter your PIN.',
          () => {
            setModalVisible(false);
            checkPaymentStatus(requestId);
          },
          {
            confirmText: 'Check Again',
            onCancel: () => setModalVisible(false),
            showCancel: true,
          }
        );
      } else {
        showModal(
          'Unknown Status',
          `Payment status: ${statusText}`,
          () => setModalVisible(false),
          {
            showCancel: false,
          }
        );
      }
    } catch (error: any) {
      console.error('Status check error:', error);
      setCheckingStatus(false);
      showModal(
        'Error',
        error instanceof Error ? error.message : 'Failed to check payment status',
        () => setModalVisible(false),
        {
          showCancel: false,
        }
      );
    }
  };

  const handleSkip = () => {
    console.log('User skipped payment');
    showModal(
      'Skip Payment?',
      'You need an active subscription to view and accept gigs. You can subscribe later from your profile.',
      () => {
        setModalVisible(false);
        router.replace('/(tabs)');
      },
      {
        confirmText: 'Skip Anyway',
        onCancel: () => setModalVisible(false),
        showCancel: true,
      }
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <ConfirmModal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        onConfirm={modalOnConfirm}
        onCancel={modalOnCancel}
        confirmText={modalConfirmText}
        showCancel={modalShowCancel}
      />
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
          Merchant: Collarless (6803513)
        </Text>
      </View>
    </SafeAreaView>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#888',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

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
