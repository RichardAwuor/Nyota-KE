
import React from 'react';
import { Tabs } from 'expo-router';
import FloatingTabBar from '@/components/FloatingTabBar';
import { useUser } from '@/contexts/UserContext';
import { colors } from '@/styles/commonStyles';

export default function TabLayout() {
  const { user } = useUser();
  const isClient = user?.userType === 'client';

  const clientTabs = [
    { name: 'index', label: 'Home', icon: 'home', route: '/(tabs)/' },
    { name: 'profile', label: 'Profile', icon: 'person', route: '/(tabs)/profile' },
  ];

  const providerTabs = [
    { name: 'index', label: 'Gigs', icon: 'work', route: '/(tabs)/' },
    { name: 'profile', label: 'Profile', icon: 'person', route: '/(tabs)/profile' },
  ];

  const tabs = isClient ? clientTabs : providerTabs;

  return (
    <React.Fragment>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <FloatingTabBar {...props} tabs={tabs} />}
      >
        <Tabs.Screen name="index" options={{ headerShown: false }} />
        <Tabs.Screen name="profile" options={{ headerShown: false }} />
      </Tabs>
    </React.Fragment>
  );
}
