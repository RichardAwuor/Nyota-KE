
import { useNetworkState } from 'expo-network';
import { SystemBars } from 'react-native-edge-to-edge';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { WidgetProvider } from '@/contexts/WidgetContext';
import { UserProvider } from '@/contexts/UserContext';
import { useColorScheme, Alert } from 'react-native';
import Constants from 'expo-constants';

// Log backend URL on app startup
console.log('=== NO-COLLAR App Starting ===');
console.log('Backend URL:', Constants.expoConfig?.extra?.backendUrl);
console.log('==============================');

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const { isConnected } = useNetworkState();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (isConnected === false) {
      Alert.alert(
        'No Internet Connection',
        'Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
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
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          </WidgetProvider>
        </UserProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
