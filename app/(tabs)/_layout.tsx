import React from 'react';
import { Tabs } from 'expo-router';
import FloatingTabBar from '@/components/FloatingTabBar';
import { useUser } from '@/contexts/UserContext';

export default function TabLayout() {
  const { user } = useUser();
  const isClient = user?.userType === 'client';

  const tabs = isClient
    ? [
        { name: 'index', label: 'Home', icon: 'home', route: '/(tabs)/' },
        { name: 'profile', label: 'Profile', icon: 'person', route: '/(tabs)/profile' },
      ]
    : [
        { name: 'index', label: 'Gigs', icon: 'work', route: '/(tabs)/' },
        { name: 'profile', label: 'Profile', icon: 'person', route: '/(tabs)/profile' },
      ];

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} tabs={tabs} />}
    >
      <Tabs.Screen name="index" options={{ headerShown: false }} />
      <Tabs.Screen name="profile" options={{ headerShown: false }} />
    </Tabs>
  );
}
