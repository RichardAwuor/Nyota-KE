
import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, Image, ImageSourcePropType } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useUser } from '@/contexts/UserContext';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

// Helper to resolve image sources (handles both local require() and remote URLs)
function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

interface DirectOffer {
  gigId: string;
  category: string;
  description: string;
  address: string;
  serviceDate: string;
  serviceTime: string;
  paymentOffer: number;
  durationDays: number;
  durationHours: number;
  timeRemainingSeconds: number;
}

export default function HomeScreen() {
  const theme = useTheme();
  const { user, provider } = useUser();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [gigs, setGigs] = useState<any[]>([]);
  const [directOffers, setDirectOffers] = useState<DirectOffer[]>([]);
  const [processingOffer, setProcessingOffer] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', message: '', onClose: () => {} });

  console.log('Home screen loaded for user type:', user?.userType);

  const fetchGigs = useCallback(async () => {
    console.log('Fetching gigs for user:', user?.userType);
    
    if (!user?.id) {
      console.log('No user ID available');
      return;
    }

    try {
      const { apiCall } = await import('@/utils/api');
      
      let data;
      if (user.userType === 'client') {
        // Fetch gigs posted by this client
        console.log('Fetching client gigs for:', user.id);
        data = await apiCall(`/api/gigs/client/${user.id}`, {
          method: 'GET',
        });
      } else if (user.userType === 'provider' && provider?.id) {
        // Fetch matching gigs for this provider (including direct offers)
        console.log('Fetching provider gigs for:', provider.id);
        data = await apiCall(`/api/gigs/matches/${provider.id}`, {
          method: 'GET',
        });
        
        // Separate direct offers from regular gigs
        const offers: DirectOffer[] = [];
        const regularGigs: any[] = [];
        
        if (data && Array.isArray(data)) {
          for (const gig of data) {
            // Check if this is a direct offer for this provider
            if (gig.selectedProviderId === provider.id && gig.status === 'pending_acceptance') {
              // Fetch detailed status to get time remaining
              try {
                const gigStatus = await apiCall(`/api/gigs/${gig.id}/status`, {
                  method: 'GET',
                });
                
                if (gigStatus.acceptOfferTimeRemainingSeconds > 0) {
                  offers.push({
                    gigId: gig.id,
                    category: gig.category,
                    description: gig.description,
                    address: gig.address,
                    serviceDate: gig.serviceDate,
                    serviceTime: gig.serviceTime,
                    paymentOffer: gig.paymentOffer,
                    durationDays: gig.durationDays,
                    durationHours: gig.durationHours,
                    timeRemainingSeconds: gigStatus.acceptOfferTimeRemainingSeconds,
                  });
                }
              } catch (statusError) {
                console.error('Error fetching gig status:', statusError);
              }
            } else if (gig.status === 'open' && !gig.selectedProviderId) {
              // Regular open gig
              regularGigs.push(gig);
            }
          }
        }
        
        setDirectOffers(offers);
        setGigs(regularGigs);
        console.log('Direct offers:', offers.length, 'Regular gigs:', regularGigs.length);
        return;
      }
      
      console.log('Gigs fetched successfully:', data);
      setGigs(data || []);
    } catch (error) {
      console.error('Error fetching gigs:', error);
      // Don't show error to user, just log it
      setGigs([]);
      setDirectOffers([]);
    }
  }, [user?.userType, user?.id, provider?.id]);

  useEffect(() => {
    if (user) {
      fetchGigs();
    }
  }, [user, fetchGigs]);

  // Poll for updates when there are direct offers
  useEffect(() => {
    if (user?.userType === 'provider' && directOffers.length > 0) {
      const interval = setInterval(() => {
        console.log('Polling for direct offer updates');
        fetchGigs();
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [user?.userType, directOffers.length, fetchGigs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGigs();
    setRefreshing(false);
  };

  const showModal = (title: string, message: string, onClose?: () => void) => {
    setModalContent({ title, message, onClose: onClose || (() => {}) });
    setModalVisible(true);
  };

  const handlePostGig = () => {
    console.log('User tapped Post a Gig button');
    router.push('/post-gig');
  };

  const handleAcceptDirectOffer = async (gigId: string) => {
    if (!provider?.id) return;
    
    console.log('Accepting direct offer for gig:', gigId);
    setProcessingOffer(gigId);

    try {
      const { apiCall } = await import('@/utils/api');
      const response = await apiCall(`/api/gigs/${gigId}/accept-direct-offer`, {
        method: 'POST',
        body: JSON.stringify({ providerId: provider.id }),
      });

      console.log('Direct offer accepted:', response);
      
      // Show success with client contact info
      showModal(
        'Gig Accepted!',
        `Client: ${response.clientName}\nPhone: ${response.clientPhoneNumber}`,
        () => fetchGigs()
      );
    } catch (error) {
      console.error('Error accepting direct offer:', error);
      showModal('Error', error instanceof Error ? error.message : 'Failed to accept offer');
    } finally {
      setProcessingOffer(null);
    }
  };

  const handleDeclineDirectOffer = async (gigId: string) => {
    if (!provider?.id) return;
    
    console.log('Declining direct offer for gig:', gigId);
    setProcessingOffer(gigId);

    try {
      const { apiCall } = await import('@/utils/api');
      await apiCall(`/api/gigs/${gigId}/decline-direct-offer`, {
        method: 'POST',
        body: JSON.stringify({ providerId: provider.id }),
      });

      console.log('Direct offer declined');
      showModal('Offer Declined', 'The gig will be offered to other providers.', () => fetchGigs());
    } catch (error) {
      console.error('Error declining direct offer:', error);
      showModal('Error', error instanceof Error ? error.message : 'Failed to decline offer');
    } finally {
      setProcessingOffer(null);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Please log in
        </Text>
      </View>
    );
  }

  // CLIENT VIEW
  if (user.userType === 'client') {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.logoHeader}>
          <Image
            source={resolveImageSource(require('@/assets/images/ff5e9bb7-eb66-4c9d-ba1f-de2beda534e1.png'))}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.header}>
          <Text style={[styles.greeting, { color: theme.colors.text }]}>
            Hello, {user.firstName}!
          </Text>
          <Text style={[styles.subtitle, { color: theme.dark ? '#98989D' : '#666' }]}>
            Ready to post a gig?
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.postButton, { backgroundColor: colors.primary }]}
          onPress={handlePostGig}
        >
          <IconSymbol
            ios_icon_name="plus.circle"
            android_material_icon_name="add-circle"
            size={32}
            color="#FFFFFF"
          />
          <Text style={styles.postButtonText}>Post a New Gig</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Your Posted Gigs
          </Text>
          
          {gigs.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.dark ? colors.cardDark : colors.card }]}>
              <IconSymbol
                ios_icon_name="briefcase"
                android_material_icon_name="work"
                size={48}
                color={theme.dark ? '#666' : '#999'}
              />
              <Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}>
                No gigs posted yet
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.dark ? '#666' : '#999' }]}>
                Tap the button above to post your first gig
              </Text>
            </View>
          ) : (
            <View>
              {gigs.map((gig) => (
                <TouchableOpacity 
                  key={gig.id} 
                  style={[styles.gigCard, { backgroundColor: theme.dark ? colors.cardDark : colors.card }]}
                  onPress={() => console.log('Gig tapped:', gig.id)}
                >
                  <View style={styles.gigHeader}>
                    <Text style={[styles.gigCategory, { color: colors.primary }]}>{gig.category}</Text>
                    <View style={[styles.statusBadge, { 
                      backgroundColor: gig.status === 'open' ? colors.success : 
                                      gig.status === 'accepted' ? colors.accent : 
                                      colors.border 
                    }]}>
                      <Text style={styles.statusText}>{gig.status}</Text>
                    </View>
                  </View>
                  <Text style={[styles.gigDescription, { color: theme.colors.text }]} numberOfLines={2}>
                    {gig.description}
                  </Text>
                  <View style={styles.gigFooter}>
                    <View style={styles.gigInfo}>
                      <IconSymbol
                        ios_icon_name="calendar"
                        android_material_icon_name="calendar-today"
                        size={16}
                        color={theme.dark ? '#98989D' : '#666'}
                      />
                      <Text style={[styles.gigInfoText, { color: theme.dark ? '#98989D' : '#666' }]}>
                        {new Date(gig.serviceDate).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.gigInfo}>
                      <IconSymbol
                        ios_icon_name="banknote"
                        android_material_icon_name="attach-money"
                        size={16}
                        color={theme.dark ? '#98989D' : '#666'}
                      />
                      <Text style={[styles.gigInfoText, { color: theme.dark ? '#98989D' : '#666' }]}>
                        KES {gig.paymentOffer}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  // PROVIDER VIEW
  const isSubscribed = provider?.subscriptionStatus === 'active';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.logoHeader}>
        <Image
          source={resolveImageSource(require('@/assets/images/ff5e9bb7-eb66-4c9d-ba1f-de2beda534e1.png'))}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <View style={styles.header}>
        <Text style={[styles.greeting, { color: theme.colors.text }]}>
          Hello, {user.firstName}!
        </Text>
        <Text style={[styles.subtitle, { color: theme.dark ? '#98989D' : '#666' }]}>
          {isSubscribed ? 'Available gigs for you' : 'Subscribe to view gigs'}
        </Text>
      </View>

      {!isSubscribed && (
        <TouchableOpacity
          style={[styles.subscribeCard, { backgroundColor: colors.accent }]}
          onPress={() => router.push('/subscription-payment')}
        >
          <IconSymbol
            ios_icon_name="exclamationmark.triangle"
            android_material_icon_name="warning"
            size={32}
            color="#000"
          />
          <View style={styles.subscribeContent}>
            <Text style={styles.subscribeTitle}>Subscription Required</Text>
            <Text style={styles.subscribeText}>
              Subscribe for KES 130/month to view and accept gigs
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Direct Offers Section */}
      {isSubscribed && directOffers.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>
            🎯 Direct Offers for You
          </Text>
          {directOffers.map((offer) => {
            const timeRemaining = Math.max(0, offer.timeRemainingSeconds);
            const minutes = Math.floor(timeRemaining / 60);
            const seconds = timeRemaining % 60;
            const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            return (
              <View 
                key={offer.gigId} 
                style={[
                  styles.gigCard, 
                  { 
                    backgroundColor: theme.dark ? colors.cardDark : colors.card,
                    borderWidth: 2,
                    borderColor: colors.accent,
                  }
                ]}
              >
                <View style={styles.gigHeader}>
                  <Text style={[styles.gigCategory, { color: colors.accent }]}>
                    {offer.category}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.statusText}>DIRECT OFFER</Text>
                  </View>
                </View>
                
                <View style={[styles.timerBadge, { backgroundColor: theme.dark ? '#2a2a2a' : '#fff3cd' }]}>
                  <IconSymbol
                    ios_icon_name="clock"
                    android_material_icon_name="access-time"
                    size={16}
                    color={colors.warning}
                  />
                  <Text style={[styles.timerText, { color: theme.colors.text }]}>
                    Time to respond: {timeDisplay}
                  </Text>
                </View>

                <Text style={[styles.gigDescription, { color: theme.colors.text }]} numberOfLines={2}>
                  {offer.description}
                </Text>
                <View style={styles.gigFooter}>
                  <View style={styles.gigInfo}>
                    <IconSymbol
                      ios_icon_name="calendar"
                      android_material_icon_name="calendar-today"
                      size={16}
                      color={theme.dark ? '#98989D' : '#666'}
                    />
                    <Text style={[styles.gigInfoText, { color: theme.dark ? '#98989D' : '#666' }]}>
                      {new Date(offer.serviceDate).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.gigInfo}>
                    <IconSymbol
                      ios_icon_name="banknote"
                      android_material_icon_name="attach-money"
                      size={16}
                      color={theme.dark ? '#98989D' : '#666'}
                    />
                    <Text style={[styles.gigInfoText, { color: theme.dark ? '#98989D' : '#666' }]}>
                      KES {offer.paymentOffer}
                    </Text>
                  </View>
                </View>

                <View style={styles.offerActions}>
                  <TouchableOpacity
                    style={[styles.offerButton, styles.declineButton, { borderColor: colors.error }]}
                    onPress={() => handleDeclineDirectOffer(offer.gigId)}
                    disabled={processingOffer === offer.gigId}
                  >
                    <Text style={[styles.declineButtonText, { color: colors.error }]}>
                      Decline
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.offerButton, styles.acceptButton, { backgroundColor: colors.success }]}
                    onPress={() => handleAcceptDirectOffer(offer.gigId)}
                    disabled={processingOffer === offer.gigId}
                  >
                    <Text style={styles.acceptButtonText}>
                      Accept Gig
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Available Gigs
        </Text>
        
        {!isSubscribed ? (
          <View style={[styles.emptyState, { backgroundColor: theme.dark ? colors.cardDark : colors.card }]}>
            <IconSymbol
              ios_icon_name="lock"
              android_material_icon_name="lock"
              size={48}
              color={theme.dark ? '#666' : '#999'}
            />
            <Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}>
              Subscribe to view gigs
            </Text>
          </View>
        ) : gigs.length === 0 && directOffers.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.dark ? colors.cardDark : colors.card }]}>
            <IconSymbol
              ios_icon_name="briefcase"
              android_material_icon_name="work"
              size={48}
              color={theme.dark ? '#666' : '#999'}
            />
            <Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}>
              No gigs available right now
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.dark ? '#666' : '#999' }]}>
              Check back later for new opportunities
            </Text>
          </View>
        ) : (
          <View>
            {gigs.map((gig) => (
              <TouchableOpacity 
                key={gig.id} 
                style={[styles.gigCard, { backgroundColor: theme.dark ? colors.cardDark : colors.card }]}
                onPress={() => console.log('Gig tapped:', gig.id)}
              >
                <View style={styles.gigHeader}>
                  <Text style={[styles.gigCategory, { color: colors.primary }]}>{gig.category}</Text>
                  <View style={[styles.statusBadge, { 
                    backgroundColor: gig.status === 'open' ? colors.success : 
                                    gig.status === 'accepted' ? colors.accent : 
                                    colors.border 
                  }]}>
                    <Text style={styles.statusText}>{gig.status}</Text>
                  </View>
                </View>
                <Text style={[styles.gigDescription, { color: theme.colors.text }]} numberOfLines={2}>
                  {gig.description}
                </Text>
                <View style={styles.gigFooter}>
                  <View style={styles.gigInfo}>
                    <IconSymbol
                      ios_icon_name="calendar"
                      android_material_icon_name="calendar-today"
                      size={16}
                      color={theme.dark ? '#98989D' : '#666'}
                    />
                    <Text style={[styles.gigInfoText, { color: theme.dark ? '#98989D' : '#666' }]}>
                      {new Date(gig.serviceDate).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.gigInfo}>
                    <IconSymbol
                      ios_icon_name="banknote"
                      android_material_icon_name="attach-money"
                      size={16}
                      color={theme.dark ? '#98989D' : '#666'}
                    />
                    <Text style={[styles.gigInfoText, { color: theme.dark ? '#98989D' : '#666' }]}>
                      KES {gig.paymentOffer}
                    </Text>
                  </View>
                  <View style={styles.gigInfo}>
                    <IconSymbol
                      ios_icon_name="location"
                      android_material_icon_name="location-on"
                      size={16}
                      color={theme.dark ? '#98989D' : '#666'}
                    />
                    <Text style={[styles.gigInfoText, { color: theme.dark ? '#98989D' : '#666' }]}>
                      {gig.address}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Custom Modal for messages */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setModalVisible(false);
          modalContent.onClose();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.dark ? colors.cardDark : colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {modalContent.title}
            </Text>
            <Text style={[styles.modalMessage, { color: theme.dark ? '#98989D' : '#666' }]}>
              {modalContent.message}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setModalVisible(false);
                modalContent.onClose();
              }}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 100,
    height: 100,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  subscribeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  subscribeContent: {
    flex: 1,
  },
  subscribeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  subscribeText: {
    fontSize: 14,
    color: '#000',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyState: {
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  gigCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  gigHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gigCategory: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    textTransform: 'capitalize',
  },
  gigDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  gigFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gigInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gigInfoText: {
    fontSize: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    gap: 6,
    marginBottom: 12,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  offerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  offerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  declineButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    borderWidth: 0,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
