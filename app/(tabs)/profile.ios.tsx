
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { useUser } from '@/contexts/UserContext';
import { colors } from '@/styles/commonStyles';

// Helper to resolve image sources (handles both local require() and remote URLs)
function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, provider, logout } = useUser();

  console.log('Profile screen loaded (iOS)');

  const handleLogout = () => {
    console.log('User logged out');
    logout();
    router.replace('/role-select');
  };

  const handleSubscribe = () => {
    console.log('Navigate to subscription payment');
    router.push('/subscription-payment');
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

  const isProvider = user.userType === 'provider';
  const isSubscribed = provider?.subscriptionStatus === 'active';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoHeader}>
          <Image
            source={resolveImageSource(require('@/assets/images/69d714db-da7a-4d1b-93ed-6a7746771724.png'))}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={[styles.header, { backgroundColor: theme.dark ? colors.cardDark : colors.card }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </Text>
          </View>
          <Text style={[styles.name, { color: theme.colors.text }]}>
            {user.firstName} {user.lastName}
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

        {isProvider && (
          <View style={[styles.section, { backgroundColor: theme.dark ? colors.cardDark : colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Subscription Status
            </Text>
            <View style={styles.subscriptionRow}>
              <IconSymbol
                ios_icon_name={isSubscribed ? 'checkmark.circle' : 'xmark.circle'}
                android_material_icon_name={isSubscribed ? 'check-circle' : 'cancel'}
                size={24}
                color={isSubscribed ? colors.success : colors.error}
              />
              <Text style={[styles.subscriptionText, { color: theme.colors.text }]}>
                {isSubscribed ? 'Active' : 'Inactive'}
              </Text>
            </View>
            {!isSubscribed && (
              <TouchableOpacity
                style={[styles.subscribeButton, { backgroundColor: colors.primary }]}
                onPress={handleSubscribe}
              >
                <Text style={styles.subscribeButtonText}>
                  Subscribe Now (KES 130/month)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={[styles.section, { backgroundColor: theme.dark ? colors.cardDark : colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Account Information
          </Text>
          
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.dark ? '#98989D' : '#666' }]}>
              Account Type
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {user.userType === 'client' ? 'Client' : 'Service Provider'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.dark ? '#98989D' : '#666' }]}>
              County
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {user.county}
            </Text>
          </View>

          {user.organizationName && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.dark ? '#98989D' : '#666' }]}>
                Organization
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
                  Gender
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                  {provider.gender.charAt(0).toUpperCase() + provider.gender.slice(1)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.dark ? '#98989D' : '#666' }]}>
                  Phone Number
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                  {provider.phoneNumber}
                </Text>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.error }]}
          onPress={handleLogout}
        >
          <IconSymbol
            ios_icon_name="arrow.right.square"
            android_material_icon_name="logout"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
    gap: 16,
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 60,
    height: 60,
  },
  header: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
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
});
