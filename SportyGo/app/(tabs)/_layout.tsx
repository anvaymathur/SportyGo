import { Tabs } from "expo-router";
import React from "react";
import { router } from "expo-router";
import { usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "tamagui";

export default function TabsLayout() {
  const pathname = usePathname();
  const topLevelPaths = [
    '/dashboard',
    '/groups/displayGroups',
    '/events/EventsList',
    '/matches/viewScore',
    '/userProfile',
  ];
  const shouldHideTabBar = !topLevelPaths.includes(pathname);
  const theme = useTheme();
  const activeColor = theme.color9?.val as string;
  const inactiveColor = theme.color10?.val as string;
  const tabIcon = (name: React.ComponentProps<typeof Ionicons>['name']) => {
    const TabIcon = ({ focused, color }: { focused: boolean; color: string }) => (
      <Ionicons name={focused ? name : (`${name}-outline` as typeof name)} size={24} color={color} />
    );
    return TabIcon;
  };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: shouldHideTabBar
          ? { display: 'none' }
          : { backgroundColor: theme.color1?.val as string, borderTopColor: theme.borderColor?.val as string },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: tabIcon('home'),
        }}
        listeners={{
          tabPress: (e) => {
            if (pathname === '/dashboard') {
              e.preventDefault();
            }
          },
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          tabBarLabel: 'Groups',
          tabBarIcon: tabIcon('people'),
        }}
        listeners={{
          tabPress: (e) => {
            if (pathname === '/groups/displayGroups') {
              e.preventDefault();
              return;
            }
            e.preventDefault();
            router.replace('/(tabs)/groups/displayGroups');
          },
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          tabBarLabel: 'Events',
          tabBarIcon: tabIcon('calendar'),
        }}
        listeners={{
          tabPress: (e) => {
            if (pathname === '/events/EventsList') {
              e.preventDefault();
              return;
            }
            e.preventDefault();
            router.replace('/(tabs)/events/EventsList');
          },
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          tabBarLabel: 'Matches',
          tabBarIcon: tabIcon('trophy'),
        }}
        listeners={{
          tabPress: (e) => {
            if (pathname === '/matches/viewScore') {
              e.preventDefault();
              return;
            }
            e.preventDefault();
            router.replace('/(tabs)/matches/viewScore');
          },
        }}
      />
      <Tabs.Screen
        name="userProfile"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: tabIcon('person'),
        }}
        listeners={{
          tabPress: (e) => {
            if (pathname === '/userProfile') {
              e.preventDefault();
            }
          },
        }}
      />
    </Tabs>
  );
}
