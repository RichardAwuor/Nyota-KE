
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, Image, ImageSourcePropType } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';

// Helper to resolve image sources (handles both local require() and remote URLs)
function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function RoleSelectScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const backgroundColor = '#FFFFFF'; // Always white background

  const handleClientSelect = () => {
    console.log('User selected Client role');
    router.push('/register-client');
  };

  const handleProviderSelect = () => {
    console.log('User selected Provider role');
    router.push('/register-provider');
  };

  const welcomeText = 'Welcome to No-Collar';
  const sloganText = 'KAZI IKO';
  const clientText = 'Client';
  const providerText = 'Service provider';
  const clientDescription = 'Post gigs and hire service providers';
  const providerDescription = 'Find gigs and earn money';

  // Color definitions
  const welcomeColor = colors.secondary; // Orange like logo
  const sloganColor = colors.primary; // Blue
  const cardTitleColor = colors.primary; // Blue for Client and Service provider

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={resolveImageSource(require('@/assets/images/69d714db-da7a-4d1b-93ed-6a7746771724.png'))}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.welcomeText, { color: welcomeColor }]}>{welcomeText}</Text>
          <Text style={[styles.sloganText, { color: sloganColor }]}>{sloganText}</Text>
        </View>

        <View style={styles.cardsContainer}>
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.secondary }]}
            onPress={handleClientSelect}
            activeOpacity={0.7}
          >
            <View style={styles.cardContent}>
              <Image
                source={resolveImageSource(require('@/assets/images/558941e1-fcea-4902-9f7a-1bcb53efb327.png'))}
                style={styles.cardImage}
                resizeMode="cover"
              />
              <Text style={[styles.cardTitle, { color: cardTitleColor }]}>{clientText}</Text>
              <Text style={[styles.cardDescription, { color: '#FFFFFF' }]}>
                {clientDescription}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.secondary }]}
            onPress={handleProviderSelect}
            activeOpacity={0.7}
          >
            <View style={styles.cardContent}>
              <Image
                source={resolveImageSource(require('@/assets/images/2b8ad1e4-a7c8-4456-9e1c-59383ed99c73.png'))}
                style={styles.cardImage}
                resizeMode="contain"
              />
              <Text style={[styles.cardTitle, { color: cardTitleColor }]}>{providerText}</Text>
              <Text style={[styles.cardDescription, { color: '#FFFFFF' }]}>
                {providerDescription}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
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
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  logo: {
    width: 300,
    height: 300,
    marginBottom: -22,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  sloganText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 1,
  },
  cardsContainer: {
    gap: 10,
    width: '100%',
    alignItems: 'center',
  },
  card: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '70%',
    maxWidth: 280,
    minHeight: 120,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImage: {
    width: 60,
    height: 60,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    textAlign: 'center',
  },
});
