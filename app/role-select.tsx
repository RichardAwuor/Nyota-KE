
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { Image, ImageSourcePropType } from 'react-native';

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

  const welcomeText = 'Welcome to Collarless';
  const sloganText = 'KAZI IKO';
  const clientText = 'Client';
  const providerText = 'Service provider';

  // Color definitions - Bright orange like logo
  const brightOrange = '#FF6B35'; // Bright orange color
  const welcomeColor = brightOrange; // Orange like logo
  const sloganColor = colors.primary; // Blue
  const boxBackgroundColor = colors.primary; // Blue boxes
  const boxTextColor = brightOrange; // Orange text for Client and Service provider

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={resolveImageSource(require('@/assets/images/3ee63232-eb73-48ff-9610-1365e85b15c1.png'))}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.welcomeText, { color: welcomeColor }]}>{welcomeText}</Text>
          <Text style={[styles.sloganText, { color: sloganColor }]}>{sloganText}</Text>
        </View>

        <View style={styles.boxesContainer}>
          <TouchableOpacity
            style={[styles.box, { backgroundColor: boxBackgroundColor }]}
            onPress={handleClientSelect}
            activeOpacity={0.7}
          >
            <Text style={[styles.boxText, { color: boxTextColor }]}>{clientText}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.box, { backgroundColor: boxBackgroundColor }]}
            onPress={handleProviderSelect}
            activeOpacity={0.7}
          >
            <Text style={[styles.boxText, { color: boxTextColor }]}>{providerText}</Text>
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
  boxesContainer: {
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 140,
  },
  boxText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
