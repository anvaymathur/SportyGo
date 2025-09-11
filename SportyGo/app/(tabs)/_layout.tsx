import { Tabs } from "expo-router";
import React from "react";
import { router } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="dashboard"
        options={{ tabBarLabel: 'Dashboard' }}
       
      />
      <Tabs.Screen
        name="groups"
        options={{ tabBarLabel: 'Groups' }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.replace('/groups/displayGroups');
          },
        }}
      />
      <Tabs.Screen
        name="events"
        options={{ tabBarLabel: 'Events' }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.replace('/events/EventsList');
          },
        }}
      />
      <Tabs.Screen
        name="matchHistory"
        options={{ tabBarLabel: 'History' }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.replace('/matchHistory/viewScore');
          },
        }}
      />
      <Tabs.Screen
        name="userProfile"
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tabs>
  );
}
