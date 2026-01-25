
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, Image, ImageSourcePropType } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

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

  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;
  const backgroundColor = isDark ? '#2A2A2A' : '#F5F5F5';

  const handleClientSelect = () => {
    console.log('User selected Client role');
    router.push('/register-client');
  };

  const handleProviderSelect = () => {
    console.log('User selected Provider role');
    router.push('/register-provider');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={resolveImageSource(require('@/assets/images/209de818-f148-4db8-af50-74bbb0761bc7.png'))}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: textColor }]}>Welcome to NO-COLLAR</Text>
          <Text style={[styles.slogan, { color: primaryColor }]}>Kazi iko</Text>
        </View>

        <View style={styles.cardsContainer}>
          <TouchableOpacity
            style={[styles.card, { backgroundColor: cardColor }]}
            onPress={handleClientSelect}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: primaryColor }]}>
              <IconSymbol
                ios_icon_name="person.fill"
                android_material_icon_name="person"
                size={20}
                color="#FFFFFF"
              />
            </View>
            <Text style={[styles.cardTitle, { color: textColor }]}>I need services</Text>
            <Text style={[styles.cardDescription, { color: textSecondaryColor }]}>
              Post gigs and hire service providers
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: cardColor }]}
            onPress={handleProviderSelect}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: primaryColor }]}>
              <IconSymbol
                ios_icon_name="briefcase.fill"
                android_material_icon_name="work"
                size={20}
                color="#FFFFFF"
              />
            </View>
            <Text style={[styles.cardTitle, { color: textColor }]}>I provide services</Text>
            <Text style={[styles.cardDescription, { color: textSecondaryColor }]}>
              Find gigs and earn money
            </Text>
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
  },
  header: {
    marginBottom: 48,
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  slogan: {
    fontSize: 18,
    fontStyle: 'italic',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardsContainer: {
    gap: 10,
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
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
