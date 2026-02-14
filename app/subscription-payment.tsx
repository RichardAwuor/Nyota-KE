
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageSourcePropType,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';

// Helper to resolve image sources (handles both local require() and remote URLs)
function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function SubscriptionPaymentScreen() {
  const router = useRouter();

  console.log('Subscription payment screen loaded - auto-transitioning in 2 seconds');

  // Automatically transition to Take-A-Gig screen after 2 seconds
  useEffect(() => {
    console.log('Auto-transitioning to Take-A-Gig screen in 2 seconds');
    const timer = setTimeout(() => {
      console.log('Navigating to Take-A-Gig screen');
      router.replace('/(tabs)/(home)');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  const transitioningText = 'Redirecting to Take-A-Gig...';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      <View style={styles.content}>
        <View style={styles.imageContainer}>
          <Image
            source={resolveImageSource(require('@/assets/images/5f49e934-ff57-4afc-8f25-a70466c61855.png'))}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          {transitioningText}
        </Text>
        
        <ActivityIndicator size="large" color="#FF0000" style={styles.loader} />
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
    justifyContent: 'center',
  },
  imageContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 200,
    height: 200,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  loader: {
    marginTop: 16,
  },
});
