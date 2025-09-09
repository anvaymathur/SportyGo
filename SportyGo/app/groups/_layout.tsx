import { Stack } from "expo-router";
import React from "react";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="createGroup" />
      <Stack.Screen name="displayGroups" />
      <Stack.Screen name="viewMembers" />
      <Stack.Screen name="[inviteCode]" />
      <Stack.Screen name="addMembers" />
    </Stack>
  );
}
