
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
  const backgroundColor = isDark ? colors.backgroundDark : colors.background;

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
            source={resolveImageSource(require('@/assets/images/69d714db-da7a-4d1b-93ed-6a7746771724.png'))}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.cardsContainer}>
          <TouchableOpacity
            style={[styles.card, { backgroundColor: cardColor }]}
            onPress={handleClientSelect}
            activeOpacity={0.7}
          >
            <View style={styles.cardContent}>
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
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: cardColor }]}
            onPress={handleProviderSelect}
            activeOpacity={0.7}
          >
            <View style={styles.cardContent}>
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
    marginBottom: 10,
    alignItems: 'center',
  },
  logo: {
    width: 300,
    height: 300,
    marginBottom: -22,
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
