

import { useNetworkState } from 'expo-network';
import { SystemBars } from 'react-native-edge-to-edge';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { WidgetProvider } from '@/contexts/WidgetContext';
import { UserProvider } from '@/contexts/UserContext';
import { useColorScheme, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Constants from 'expo-constants';

// Log backend URL on app startup
console.log('=== Nyota-KE App Starting ===');
console.log('Backend URL:', Constants.expoConfig?.extra?.backendUrl);
console.log('==============================');

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Custom Modal for network error (cross-platform compatible)
function NetworkErrorModal({ 
  visible, 
  onRetry 
}: { 
  visible: boolean; 
  onRetry: () => void; 
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#1C1C1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.content, { backgroundColor: bgColor }]}>
          <Text style={[modalStyles.title, { color: textColor }]}>No Internet Connection</Text>
          <Text style={[modalStyles.message, { color: textColor }]}>
            Please check your internet connection and try again.
          </Text>
          <TouchableOpacity
            style={modalStyles.button}
            onPress={onRetry}
          >
            <Text style={modalStyles.buttonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const { isConnected } = useNetworkState();
  const colorScheme = useColorScheme();
  const [showNetworkError, setShowNetworkError] = React.useState(false);

  useEffect(() => {
    if (loaded) {
      // Only hide splash screen when fonts are loaded
      // The app/index.tsx will handle the final hiding after navigation
      console.log('Fonts loaded');
    }
  }, [loaded]);

  useEffect(() => {
    if (isConnected === false) {
      setShowNetworkError(true);
    }
  }, [isConnected]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <UserProvider>
          <WidgetProvider>
            <SystemBars style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="role-select" options={{ headerShown: false }} />
              <Stack.Screen name="register-client" options={{ headerShown: false }} />
              <Stack.Screen name="register-provider" options={{ headerShown: false }} />
              <Stack.Screen name="subscription-payment" options={{ headerShown: false }} />
              <Stack.Screen name="post-gig" options={{ headerShown: false }} />
              <Stack.Screen name="payment-simulator" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <NetworkErrorModal 
              visible={showNetworkError} 
              onRetry={() => setShowNetworkError(false)} 
            />
          </WidgetProvider>
        </UserProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
