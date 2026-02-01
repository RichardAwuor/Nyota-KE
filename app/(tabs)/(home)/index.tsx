
import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useUser } from '@/contexts/UserContext';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

export default function HomeScreen() {
  const theme = useTheme();
  const { user, provider } = useUser();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [gigs, setGigs] = useState<any[]>([]);

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
        // Fetch matching gigs for this provider
        console.log('Fetching provider gigs for:', provider.id);
        data = await apiCall(`/api/gigs/matches/${provider.id}`, {
          method: 'GET',
        });
      }
      
      console.log('Gigs fetched successfully:', data);
      setGigs(data || []);
    } catch (error) {
      console.error('Error fetching gigs:', error);
      // Don't show error to user, just log it
      setGigs([]);
    }
  }, [user?.userType, user?.id, provider?.id]);

  useEffect(() => {
    if (user) {
      fetchGigs();
    }
  }, [user, fetchGigs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGigs();
    setRefreshing(false);
  };

  const handlePostGig = () => {
    console.log('User tapped Post a Gig button');
    router.push('/post-gig');
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
        ) : gigs.length === 0 ? (
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
});
