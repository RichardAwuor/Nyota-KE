
import React from 'react';
import { Tabs } from 'expo-router';
import FloatingTabBar from '@/components/FloatingTabBar';
import { useUser } from '@/contexts/UserContext';
import { colors } from '@/styles/commonStyles';

export default function TabLayout() {
  const { user } = useUser();

  const isClient = user?.userType === 'client';
  const isProvider = user?.userType === 'provider';

  const clientTabs = [
    { name: 'index', title: 'Home', icon: 'home', label: 'Home', route: '/(tabs)/' },
    { name: 'profile', title: 'Profile', icon: 'person', label: 'Profile', route: '/(tabs)/profile' },
  ];

  const providerTabs = [
    { name: 'index', title: 'Gigs', icon: 'work', label: 'Gigs', route: '/(tabs)/' },
    { name: 'profile', title: 'Profile', icon: 'person', label: 'Profile', route: '/(tabs)/profile' },
  ];

  const tabs = isClient ? clientTabs : providerTabs;

  return (
    <React.Fragment>
      <Tabs
        screenOptions={{
          headerShown: false,
        }}
        tabBar={(props) => <FloatingTabBar {...props} tabs={tabs} />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </React.Fragment>
  );
}
