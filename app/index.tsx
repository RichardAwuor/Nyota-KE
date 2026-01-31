
import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, ImageSourcePropType } from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { colors } from '@/styles/commonStyles';
import { useColorScheme } from 'react-native';

// Helper to resolve image sources (handles both local require() and remote URLs)
function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function SplashScreen() {
  const router = useRouter();
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const navigateBasedOnUser = useCallback(() => {
    if (user) {
      console.log('User found, navigating to tabs');
      router.replace('/(tabs)');
    } else {
      console.log('No user found, navigating to role selection');
      router.replace('/role-select');
    }
  }, [user, router]);

  useEffect(() => {
    console.log('Splash screen loaded, checking user status');
    const timer = setTimeout(() => {
      navigateBasedOnUser();
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigateBasedOnUser]);

  const orangeColor = '#FF6B35';
  const blackColor = '#000000';
  const appName = 'Collarless';
  const sloganText = 'Kazi iko';

  return (
    <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      <View style={styles.content}>
        <Image
          source={resolveImageSource(require('@/assets/images/ae78519a-70c7-4e0f-bd7c-69f21a10e190.png'))}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.title, { color: orangeColor }]}>{appName}</Text>
        <Text style={[styles.slogan, { color: blackColor }]}>{sloganText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    width: 240,
    height: 240,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  slogan: {
    fontSize: 20,
    fontStyle: 'italic',
  },
});
