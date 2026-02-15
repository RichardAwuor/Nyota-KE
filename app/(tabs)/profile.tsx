
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Image, ImageSourcePropType, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { useUser } from '@/contexts/UserContext';
import { colors } from '@/styles/commonStyles';
import { apiCall } from '@/utils/api';

// Helper to resolve image sources (handles both local require() and remote URLs)
function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

interface MatchedProvider {
  id: string;
  userId: string;
  providerCode: string;
  photoUrl: string;
  gender: string;
  services: string[];
  distance?: number;
  phoneNumber?: string;
}

interface RecentGig {
  id: string;
  category: string;
  status: string;
  createdAt: string;
  selectedProviderId?: string;
  acceptedProviderId?: string;
  selectionExpiresAt?: string;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, provider, logout } = useUser();

  const [recentGig, setRecentGig] = useState<RecentGig | null>(null);
  const [matchedProviders, setMatchedProviders] = useState<MatchedProvider[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [selectedProvider, setSelectedProvider] = useState<MatchedProvider | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [acceptedProviderDetails, setAcceptedProviderDetails] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  console.log('Profile screen loaded');

  const isProvider = user?.userType === 'provider';
  const isClient = user?.userType === 'client';
  const isSubscribed = provider?.subscriptionStatus === 'active';

  const fetchRecentGigAndMatches = useCallback(async () => {
    if (!isClient || !user?.id) {
      console.log('Skipping fetch: not a client or no user ID');
      return;
    }

    console.log('Fetching recent gig and matched providers for client:', user.id);
    setLoadingMatches(true);
    setFetchError(null);
    
    try {
      const gigs = await apiCall<RecentGig[]>(`/api/gigs/client/${user.id}`);
      
      if (!isMountedRef.current) {
        console.log('Component unmounted, skipping state update');
        return;
      }
      
      if (gigs && gigs.length > 0) {
        const mostRecentGig = gigs[0];
        setRecentGig(mostRecentGig);
        console.log('Recent gig fetched:', mostRecentGig);

        if (mostRecentGig.status === 'accepted' && mostRecentGig.acceptedProviderId) {
          console.log('Gig is accepted, fetching provider details');
          try {
            const gigStatus = await apiCall<any>(`/api/gigs/${mostRecentGig.id}/status`);
            if (gigStatus.providerContact && isMountedRef.current) {
              setAcceptedProviderDetails(gigStatus.providerContact);
              console.log('Provider contact details:', gigStatus.providerContact);
            }
          } catch (statusError) {
            console.error('Error fetching gig status:', statusError);
          }
        } else if (mostRecentGig.status === 'open') {
          console.log('Gig is open, calculating time remaining and fetching matches');
          const createdAt = new Date(mostRecentGig.createdAt).getTime();
          const now = Date.now();
          const elapsed = Math.floor((now - createdAt) / 1000);
          const remaining = Math.max(0, 180 - elapsed);
          
          if (isMountedRef.current) {
            setTimeRemaining(remaining);
            console.log('Time remaining for selection:', remaining, 'seconds');
          }

          try {
            const matches = await apiCall<MatchedProvider[]>(`/api/gigs/${mostRecentGig.id}/matched-providers`);
            if (isMountedRef.current) {
              setMatchedProviders(matches || []);
              console.log('Matched providers fetched:', matches?.length || 0);
            }
          } catch (matchError) {
            console.error('Error fetching matched providers:', matchError);
            if (isMountedRef.current) {
              setMatchedProviders([]);
            }
          }
        }
      } else {
        console.log('No gigs found for client');
        if (isMountedRef.current) {
          setRecentGig(null);
          setMatchedProviders([]);
        }
      }
    } catch (error) {
      console.error('Error fetching gig and matches:', error);
      if (isMountedRef.current) {
        setRecentGig(null);
        setMatchedProviders([]);
        setFetchError(error instanceof Error ? error.message : 'Failed to load gig data');
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingMatches(false);
      }
    }
  }, [isClient, user?.id]);

  useFocusEffect(
    useCallback(() => {
      console.log('Profile screen focused, fetching data');
      isMountedRef.current = true;
      
      if (isClient && user?.id) {
        fetchRecentGigAndMatches();
      }
      
      return () => {
        console.log('Profile screen unfocused');
        isMountedRef.current = false;
      };
    }, [isClient, user?.id, fetchRecentGigAndMatches])
  );

  useEffect(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (isClient && recentGig && (recentGig.status === 'open' || recentGig.selectedProviderId)) {
      console.log('Starting polling for gig status updates');
      pollingIntervalRef.current = setInterval(() => {
        console.log('Polling for gig status updates');
        fetchRecentGigAndMatches();
      }, 5000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        console.log('Stopping polling');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isClient, recentGig?.id, recentGig?.status, recentGig?.selectedProviderId, fetchRecentGigAndMatches]);

  useEffect(() => {
    if (timeRemaining > 0 && recentGig && !recentGig.selectedProviderId && !recentGig.acceptedProviderId) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleBroadcastGig();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeRemaining, recentGig]);

  const handleSelectProvider = (provider: MatchedProvider) => {
    console.log('Provider selected for confirmation:', provider.providerCode);
    setSelectedProvider(provider);
    setShowConfirmModal(true);
  };

  const confirmSelectProvider = async () => {
    if (!selectedProvider || !recentGig) return;

    console.log('Confirming provider selection:', selectedProvider.providerCode);
    setShowConfirmModal(false);

    try {
      await apiCall(`/api/gigs/${recentGig.id}/select-provider`, {
        method: 'POST',
        body: JSON.stringify({ providerId: selectedProvider.id }),
      });

      console.log('Provider selected successfully');
      
      setRecentGig({
        ...recentGig,
        selectedProviderId: selectedProvider.id,
      });

      setTimeRemaining(0);
      setMatchedProviders([]);
    } catch (error) {
      console.error('Error selecting provider:', error);
    }
  };

  const handleBroadcastGig = async () => {
    if (!recentGig) return;

    console.log('Broadcasting gig to universe');
    
    try {
      await apiCall(`/api/gigs/${recentGig.id}/broadcast`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      console.log('Gig broadcast successfully');
      
      setMatchedProviders([]);
      setTimeRemaining(0);
    } catch (error) {
      console.error('Error broadcasting gig:', error);
    }
  };

  const handleLogout = () => {
    console.log('User logged out');
    logout();
    router.replace('/role-select');
  };

  const handleSubscribe = () => {
    console.log('Navigate to subscription payment');
    router.push('/subscription-payment');
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const minsDisplay = mins.toString();
    const secsDisplay = secs.toString().padStart(2, '0');
    return `${minsDisplay}:${secsDisplay}`;
  };

  const timeDisplay = formatTime(timeRemaining);

  if (!user) {
    const pleaseLoginText = 'Please log in';
    return (
      <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {pleaseLoginText}
        </Text>
      </View>
    );
  }

  const firstInitial = user.firstName?.charAt(0).toUpperCase() || 'U';
  const lastInitial = user.lastName?.charAt(0).toUpperCase() || 'U';
  const initials = `${firstInitial}${lastInitial}`;
  const fullName = `${user.firstName} ${user.lastName}`;
  const accountTypeText = user.userType === 'client' ? 'Client' : 'Service Provider';
  const recentGigTitle = 'Recent Gig';
  const acceptedText = 'Accepted';
  const openText = 'Open';
  const gigAcceptedTitle = 'Gig Accepted!';
  const providerLabel = 'Provider:';
  const codeLabel = 'Code:';
  const phoneLabel = 'Phone:';
  const timeToSelectPrefix = 'Time to select: ';
  const topMatchedTitle = 'Top Matched Service Providers';
  const noMatchesText = 'No matched providers available';
  const waitingText = 'Waiting for provider response...';
  const waitingSubtext = 'If they decline or don&apos;t respond in 3 minutes, the gig will be broadcast to all matched providers.';
  const subscriptionStatusTitle = 'Subscription Status';
  const activeText = 'Active';
  const inactiveText = 'Inactive';
  const subscribeButtonText = 'Subscribe Now (KES 130/month)';
  const accountInfoTitle = 'Account Information';
  const accountTypeLabel = 'Account Type';
  const countyLabel = 'County';
  const organizationLabel = 'Organization';
  const genderLabel = 'Gender';
  const phoneNumberLabel = 'Phone Number';
  const logoutButtonText = 'Log Out';
  const confirmSelectionTitle = 'Confirm Selection';
  const confirmMessagePrefix = 'Send direct gig offer to ';
  const confirmMessageSuffix = '?';
  const confirmSubtext = 'They will have 3 minutes to accept. If they decline or don&apos;t respond, the gig will be broadcast to all matched providers.';
  const cancelText = 'Cancel';
  const confirmText = 'Confirm';
  const selectText = 'Select';
  const retryText = 'Retry';

  const genderDisplay = provider?.gender ? provider.gender.charAt(0).toUpperCase() + provider.gender.slice(1) : '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoHeader}>
          <Image
            source={require('@/assets/images/e5ba27fb-676c-43fc-89f4-e37936a130d9.png')}
            style={styles.appLogo}
          />
        </View>

        <View style={[styles.header, { backgroundColor: theme.dark ? colors.cardDark : colors.card }]}>
          <View style={styles.avatarInitialsContainer}>
            <Text style={styles.avatarInitialsText}>{initials}</Text>
          </View>
          <Text style={[styles.name, { color: theme.colors.text }]}>
            {fullName}
          </Text>
          <Text style={[styles.email, { color: theme.dark ? '#98989D' : '#666' }]}>
            {user.email}
          </Text>
          {isProvider && provider && (
            <Text style={[styles.providerCode, { color: colors.primary }]}>
              {provider.providerCode}
            </Text>
          )}
        </View>

        {isClient && (
          <>
            {fetchError && (
              <View style={[styles.errorCard, { backgroundColor: theme.dark ? '#2a1a1a' : '#ffe0e0' }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {fetchError}
                </Text>
                <TouchableOpacity
                  style={[styles.retryButton, { backgroundColor: colors.primary }]}
                  onPress={fetchRecentGigAndMatches}
                >
                  <Text style={styles.retryButtonText}>{retryText}</Text>
                </TouchableOpacity>
              </View>
            )}

            {recentGig && (
              <View style={[styles.section, { backgroundColor: theme.dark ? colors.cardDark : colors.card }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  {recentGigTitle}
                </Text>
                
                <View style={styles.gigInfo}>
                  <Text style={[styles.gigCategory, { color: theme.colors.text }]}>
                    {recentGig.category}
                  </Text>
                  <Text style={[styles.gigStatus, { color: recentGig.status === 'accepted' ? colors.success : colors.primary }]}>
                    {recentGig.status === 'accepted' ? acceptedText : openText}
                  </Text>
                </View>

                {recentGig.status === 'accepted' && acceptedProviderDetails && (
                  <View style={[styles.acceptedProviderCard, { backgroundColor: theme.dark ? '#1a1a1a' : '#f9f9f9' }]}>
                    <Text style={[styles.acceptedTitle, { color: colors.success }]}>
                      {gigAcceptedTitle}
                    </Text>
                    <View style={styles.providerContactRow}>
                      <Text style={[styles.contactLabel, { color: theme.dark ? '#98989D' : '#666' }]}>
                        {providerLabel}
                      </Text>
                      <Text style={[styles.contactValue, { color: theme.colors.text }]}>
                        {acceptedProviderDetails.name}
                      </Text>
                    </View>
                    <View style={styles.providerContactRow}>
                      <Text style={[styles.contactLabel, { color: theme.dark ? '#98989D' : '#666' }]}>
                        {codeLabel}
                      </Text>
                      <Text style={[styles.contactValue, { color: theme.colors.text }]}>
                        {acceptedProviderDetails.providerCode}
                      </Text>
                    </View>
                    <View style={styles.providerContactRow}>
                      <Text style={[styles.contactLabel, { color: theme.dark ? '#98989D' : '#666' }]}>
                        {phoneLabel}
                      </Text>
                      <Text style={[styles.contactValue, { color: colors.primary }]}>
                        {acceptedProviderDetails.phoneNumber}
                      </Text>
                    </View>
                  </View>
                )}

                {recentGig.status === 'open' && !recentGig.selectedProviderId && timeRemaining > 0 && (
                  <>
                    <View style={[styles.timerCard, { backgroundColor: theme.dark ? '#1a1a1a' : '#fff3cd' }]}>
                      <IconSymbol
                        ios_icon_name="clock"
                        android_material_icon_name="access-time"
                        size={20}
                        color={colors.primary}
                      />
                      <Text style={[styles.timerText, { color: theme.colors.text }]}>
                        {timeToSelectPrefix}{timeDisplay}
                      </Text>
                    </View>

                    {loadingMatches ? (
                      <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
                    ) : matchedProviders.length > 0 ? (
                      <>
                        <Text style={[styles.matchedTitle, { color: theme.colors.text }]}>
                          {topMatchedTitle}
                        </Text>
                        {matchedProviders.map((provider, index) => {
                          const distanceText = provider.distance ? `${provider.distance.toFixed(1)} km away` : '';
                          return (
                            <View key={index} style={[styles.providerCard, { backgroundColor: theme.dark ? '#1a1a1a' : '#f9f9f9' }]}>
                              <Image
                                source={resolveImageSource(provider.photoUrl)}
                                style={styles.providerPhoto}
                              />
                              <View style={styles.providerInfo}>
                                <Text style={[styles.providerCodeText, { color: theme.colors.text }]}>
                                  {provider.providerCode}
                                </Text>
                                <Text style={[styles.providerGender, { color: theme.dark ? '#98989D' : '#666' }]}>
                                  {provider.gender}
                                </Text>
                                {provider.distance && (
                                  <Text style={[styles.providerDistance, { color: theme.dark ? '#98989D' : '#666' }]}>
                                    {distanceText}
                                  </Text>
                                )}
                              </View>
                              <TouchableOpacity
                                style={[styles.selectButton, { backgroundColor: colors.primary }]}
                                onPress={() => handleSelectProvider(provider)}
                              >
                                <Text style={styles.selectButtonText}>
                                  {selectText}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </>
                    ) : (
                      <Text style={[styles.noMatchesText, { color: theme.dark ? '#98989D' : '#666' }]}>
                        {noMatchesText}
                      </Text>
                    )}
                  </>
                )}

                {recentGig.status === 'open' && recentGig.selectedProviderId && !recentGig.acceptedProviderId && (
                  <View style={[styles.waitingCard, { backgroundColor: theme.dark ? '#1a1a1a' : '#e7f3ff' }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.waitingText, { color: theme.colors.text }]}>
                      {waitingText}
                    </Text>
                    <Text style={[styles.waitingSubtext, { color: theme.dark ? '#98989D' : '#666' }]}>
                      {waitingSubtext}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {isProvider && (
          <View style={[styles.section, { backgroundColor: theme.dark ? colors.cardDark : colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {subscriptionStatusTitle}
            </Text>
            <View style={styles.subscriptionRow}>
              <IconSymbol
                ios_icon_name={isSubscribed ? 'checkmark.circle' : 'xmark.circle'}
                android_material_icon_name={isSubscribed ? 'check-circle' : 'cancel'}
                size={24}
                color={isSubscribed ? colors.success : colors.error}
              />
              <Text style={[styles.subscriptionText, { color: theme.colors.text }]}>
                {isSubscribed ? activeText : inactiveText}
              </Text>
            </View>
            {!isSubscribed && (
              <TouchableOpacity
                style={[styles.subscribeButton, { backgroundColor: colors.primary }]}
                onPress={handleSubscribe}
              >
                <Text style={styles.subscribeButtonText}>
                  {subscribeButtonText}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={[styles.section, { backgroundColor: theme.dark ? colors.cardDark : colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {accountInfoTitle}
          </Text>
          
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.dark ? '#98989D' : '#666' }]}>
              {accountTypeLabel}
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {accountTypeText}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.dark ? '#98989D' : '#666' }]}>
              {countyLabel}
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {user.county}
            </Text>
          </View>

          {user.organizationName && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.dark ? '#98989D' : '#666' }]}>
                {organizationLabel}
              </Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                {user.organizationName}
              </Text>
            </View>
          )}

          {isProvider && provider && (
            <>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.dark ? '#98989D' : '#666' }]}>
                  {genderLabel}
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                  {genderDisplay}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.dark ? '#98989D' : '#666' }]}>
                  {phoneNumberLabel}
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                  {provider.phoneNumber}
                </Text>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.primary }]}
          onPress={handleLogout}
        >
          <IconSymbol
            ios_icon_name="arrow.right.square"
            android_material_icon_name="logout"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.logoutButtonText}>{logoutButtonText}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showConfirmModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.dark ? colors.cardDark : colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {confirmSelectionTitle}
            </Text>
            <Text style={[styles.modalMessage, { color: theme.dark ? '#98989D' : '#666' }]}>
              {confirmMessagePrefix}{selectedProvider?.providerCode}{confirmMessageSuffix}
            </Text>
            <Text style={[styles.modalSubtext, { color: theme.dark ? '#98989D' : '#666' }]}>
              {confirmSubtext}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.dark ? '#2a2a2a' : '#e0e0e0' }]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, { backgroundColor: colors.primary }]}
                onPress={confirmSelectProvider}
              >
                <Text style={styles.confirmButtonText}>
                  {confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 48 : 16,
    paddingBottom: 100,
    gap: 16,
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  appLogo: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  header: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  avatarInitialsContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF0000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarInitialsText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    marginBottom: 8,
  },
  providerCode: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  errorCard: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  gigInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  gigCategory: {
    fontSize: 16,
    fontWeight: '600',
  },
  gigStatus: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  acceptedProviderCard: {
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  acceptedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  providerContactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  contactLabel: {
    fontSize: 14,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  timerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loader: {
    marginVertical: 20,
  },
  matchedTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  providerPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  providerInfo: {
    flex: 1,
    gap: 4,
  },
  providerCodeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  providerGender: {
    fontSize: 12,
  },
  providerDistance: {
    fontSize: 12,
  },
  selectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  noMatchesText: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 20,
  },
  waitingCard: {
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
    gap: 8,
  },
  waitingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  waitingSubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  subscriptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  subscribeButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  infoLabel: {
    fontSize: 16,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    padding: 24,
    borderRadius: 12,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
  },
  modalSubtext: {
    fontSize: 13,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    borderWidth: 0,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 40,
  },
});
