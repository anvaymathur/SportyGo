import { Tabs } from "expo-router";
import React from "react";
import { router } from "expo-router";
import { usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  const pathname = usePathname();
  const topLevelPaths = [
    '/dashboard',
    '/groups/displayGroups',
    '/events/EventsList',
    '/matchHistory/viewScore',
    '/userProfile',
  ];
  const shouldHideTabBar = !topLevelPaths.includes(pathname);
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: shouldHideTabBar ? { display: 'none' } : undefined }}>
      <Tabs.Screen
        name="dashboard"
        options={{ 
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused }) => (
            <Ionicons name="home" size={24} color={focused ? 'black' : 'gray'} />
          ),
        }}
       
      />
      <Tabs.Screen
        name="groups"
        options={{ 
          tabBarLabel: 'Groups',
          tabBarIcon: ({ focused }) => (
            <Ionicons name="people" size={24} color={focused ? 'black' : 'gray'} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.replace('/groups/displayGroups');
          },
        }}
      />
      <Tabs.Screen
        name="events"
        options={{ 
          tabBarLabel: 'Events',
          tabBarIcon: ({ focused }) => (
            <Ionicons name="calendar" size={24} color={focused ? 'black' : 'gray'} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.replace('/events/EventsList');
          },
        }}
      />
      <Tabs.Screen
        name="matchHistory"
        options={{ 
          tabBarLabel: 'History',
          tabBarIcon: ({ focused }) => (
            <Ionicons name="trophy" size={24} color={focused ? 'black' : 'gray'} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.replace('/matchHistory/viewScore');
          },
        }}
      />
      <Tabs.Screen
        name="userProfile"
        options={{ 
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => (
            <Ionicons name="person" size={24} color={focused ? 'black' : 'gray'} />
          ),
        }}
      />
    </Tabs>
  );
}
