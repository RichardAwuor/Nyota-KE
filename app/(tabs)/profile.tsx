import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { apiCall } from '@/utils/api';

interface RecentGig {
  id: string;
  category: string;
  status: string;
  address: string;
  paymentOffer: number;
  createdAt: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, provider, logout } = useUser();
  const [recentGig, setRecentGig] = useState<RecentGig | null>(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const fetchGig = async () => {
        if (!user?.id || user.userType !== 'client') return;
        setLoading(true);
        console.log('[Profile] Fetching recent gigs for client', user.id);
        try {
          const gigs = await apiCall<RecentGig[]>(`/api/gigs/client/${user.id}`);
          if (active && gigs && gigs.length > 0) {
            setRecentGig(gigs[0]);
          }
        } catch (e) {
          console.log('[Profile] Failed to fetch gigs:', e);
          // silently fail — profile still renders without gig data
        } finally {
          if (active) setLoading(false);
        }
      };

      fetchGig();
      return () => { active = false; };
    }, [user?.id, user?.userType])
  );

  const handleLogout = () => {
    console.log('[Profile] Logout pressed');
    logout();
    router.replace('/role-select');
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Please log in</Text>
        </View>
      </SafeAreaView>
    );
  }

  const firstInitial = user.firstName?.charAt(0) ?? '';
  const lastInitial = user.lastName?.charAt(0) ?? '';
  const initials = `${firstInitial}${lastInitial}`.toUpperCase();
  const isClient = user.userType === 'client';
  const isProvider = user.userType === 'provider';
  const isSubscribed = provider?.subscriptionStatus === 'active';
  const accountTypeLabel = isClient ? 'Client' : 'Service Provider';
  const gigStatusColor = recentGig?.status === 'accepted' ? styles.badgeGreen : styles.badgeRed;
  const gigStatusText = recentGig ? recentGig.status.toUpperCase() : '';
  const subscriptionStatusColor = isSubscribed ? '#34C759' : '#E53935';
  const subscriptionStatusText = isSubscribed ? 'Active' : 'Inactive';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{user.firstName} {user.lastName}</Text>
          <Text style={styles.email}>{user.email}</Text>
          {isProvider && provider?.providerCode && (
            <Text style={styles.providerCode}>{provider.providerCode}</Text>
          )}
        </View>

        {/* Client: Recent Gig */}
        {isClient && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Gig</Text>
            {loading ? (
              <ActivityIndicator color="#E53935" />
            ) : recentGig ? (
              <View>
                <View style={styles.row}>
                  <Text style={styles.gigCategory}>{recentGig.category}</Text>
                  <View style={[styles.badge, gigStatusColor]}>
                    <Text style={styles.badgeText}>{gigStatusText}</Text>
                  </View>
                </View>
                <Text style={styles.gigDetail}>📍 {recentGig.address}</Text>
                <Text style={styles.gigDetail}>💰 KES {recentGig.paymentOffer}</Text>
              </View>
            ) : (
              <Text style={styles.emptyText}>No gigs posted yet. Go to Home to post one.</Text>
            )}
          </View>
        )}

        {/* Provider: Subscription */}
        {isProvider && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Subscription</Text>
            <View style={styles.row}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={[styles.infoValue, { color: subscriptionStatusColor }]}>
                {subscriptionStatusText}
              </Text>
            </View>
            {!isSubscribed && (
              <TouchableOpacity
                style={styles.subscribeButton}
                onPress={() => { console.log('[Profile] Subscribe button pressed'); router.push('/subscription-payment'); }}
              >
                <Text style={styles.subscribeButtonText}>Subscribe — KES 130/month</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Account Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Information</Text>
          <View style={styles.row}>
            <Text style={styles.infoLabel}>Account Type</Text>
            <Text style={styles.infoValue}>{accountTypeLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.infoLabel}>County</Text>
            <Text style={styles.infoValue}>{user.county}</Text>
          </View>
          {isProvider && provider?.phoneNumber && (
            <View style={styles.row}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{provider.phoneNumber}</Text>
            </View>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#E53935', justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 30, fontWeight: 'bold', color: '#fff' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  email: { fontSize: 15, color: '#666', marginBottom: 4 },
  providerCode: { fontSize: 14, color: '#E53935', fontWeight: '600' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, elevation: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 12 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  gigCategory: { fontSize: 16, fontWeight: '600', color: '#111', flex: 1 },
  gigDetail: { fontSize: 14, color: '#666', marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeGreen: { backgroundColor: '#34C759' },
  badgeRed: { backgroundColor: '#E53935' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  infoLabel: { fontSize: 15, color: '#666' },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#111' },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 8 },
  subscribeButton: {
    backgroundColor: '#E53935', borderRadius: 8,
    padding: 12, alignItems: 'center', marginTop: 12,
  },
  subscribeButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  logoutButton: {
    backgroundColor: '#E53935', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
