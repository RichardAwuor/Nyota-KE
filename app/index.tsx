
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

  const textColor = isDark ? colors.textDark : colors.text;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image
          source={resolveImageSource(require('@/assets/images/209de818-f148-4db8-af50-74bbb0761bc7.png'))}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.title, { color: textColor }]}>NO-COLLAR</Text>
        <Text style={[styles.slogan, { color: primaryColor }]}>Kazi iko</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
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
