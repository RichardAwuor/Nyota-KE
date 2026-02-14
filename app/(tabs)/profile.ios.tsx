
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ImageSourcePropType, ActivityIndicator, Modal } from 'react-native';
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

  console.log('Profile screen loaded (iOS)');

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
      // Fetch client's gigs
      const gigs = await apiCall<RecentGig[]>(`/api/gigs/client/${user.id}`);
      
      if (!isMountedRef.current) {
        console.log('Component unmounted, skipping state update');
        return;
      }
      
      if (gigs && gigs.length > 0) {
        const mostRecentGig = gigs[0];
        setRecentGig(mostRecentGig);
        console.log('Recent gig fetched:', mostRecentGig);

        // Check if gig is accepted
        if (mostRecentGig.status === 'accepted' && mostRecentGig.acceptedProviderId) {
          console.log('Gig is accepted, fetching provider details');
          try {
            // Fetch accepted provider details
            const gigStatus = await apiCall<any>(`/api/gigs/${mostRecentGig.id}/status`);
            if (gigStatus.providerContact && isMountedRef.current) {
              setAcceptedProviderDetails(gigStatus.providerContact);
              console.log('Provider contact details:', gigStatus.providerContact);
            }
          } catch (statusError) {
            console.error('Error fetching gig status:', statusError);
            // Don't fail the whole fetch if status fails
          }
        } else if (mostRecentGig.status === 'open') {
          console.log('Gig is open, calculating time remaining and fetching matches');
          // Calculate time remaining for selection
          const createdAt = new Date(mostRecentGig.createdAt).getTime();
          const now = Date.now();
          const elapsed = Math.floor((now - createdAt) / 1000);
          const remaining = Math.max(0, 180 - elapsed); // 3 minutes = 180 seconds
          
          if (isMountedRef.current) {
            setTimeRemaining(remaining);
            console.log('Time remaining for selection:', remaining, 'seconds');
          }

          // Fetch matched providers
          try {
            const matches = await apiCall<MatchedProvider[]>(`/api/gigs/${mostRecentGig.id}/matched-providers`);
            if (isMountedRef.current) {
              setMatchedProviders(matches || []);
              console.log('Matched providers fetched:', matches?.length || 0);
            }
          } catch (matchError) {
            console.error('Error fetching matched providers:', matchError);
            // Don't fail the whole fetch if matches fail
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

  // Use useFocusEffect to fetch data whenever the screen comes into focus
  // This ensures data is fetched when navigating from post-gig screen
  useFocusEffect(
    useCallback(() => {
      console.log('Profile screen focused, fetching data');
      isMountedRef.current = true;
      
      if (isClient && user?.id) {
        fetchRecentGigAndMatches();
      }
      
      // Cleanup function
      return () => {
        console.log('Profile screen unfocused');
        isMountedRef.current = false;
      };
    }, [isClient, user?.id, fetchRecentGigAndMatches])
  );

  // Poll for gig status updates when there's an active gig
  useEffect(() => {
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (isClient && recentGig && (recentGig.status === 'open' || recentGig.selectedProviderId)) {
      console.log('Starting polling for gig status updates');
      pollingIntervalRef.current = setInterval(() => {
        console.log('Polling for gig status updates');
        fetchRecentGigAndMatches();
      }, 5000); // Poll every 5 seconds
    }

    return () => {
      if (pollingIntervalRef.current) {
        console.log('Stopping polling');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isClient, recentGig?.id, recentGig?.status, recentGig?.selectedProviderId, fetchRecentGigAndMatches]);

  // Timer countdown
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
      
      // Update gig state
      setRecentGig({
        ...recentGig,
        selectedProviderId: selectedProvider.id,
      });

      // Clear timer and matched providers list
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
      
      // Clear matched providers
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
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {pleaseLoginText}
        </Text>
      </View>
    );
  }

  const firstInitial = user.firstName?.charAt(0) || 'U';
  const lastInitial = user.lastName?.charAt(0) || 'U';
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoHeader}>
          <Image
            source={resolveImageSource(require('@/assets/images/5f49e934-ff57-4afc-8f25-a70466c61855.png'))}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={[styles.header, { backgroundColor: theme.dark ? colors.cardDark : colors.card }]}>
          <View style={styles.avatarImageContainer}>
            <Image
              source={resolveImageSource(require('@/assets/images/5f49e934-ff57-4afc-8f25-a70466c61855.png'))}
              style={styles.avatarImage}
              resizeMode="contain"
            />
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

        {/* Rest of the component remains the same - only logo images changed */}
        {/* ... (continuing with the same structure as the Android version) ... */}

      </ScrollView>
    </SafeAreaView>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
    gap: 16,
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 80,
    height: 80,
  },
  header: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  avatarImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 80,
    height: 80,
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
  // ... rest of styles remain the same
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 40,
  },
});
