import { Stack } from "expo-router";
import React from "react";
export default function  AuthLayout   () {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EventsList" />
      <Stack.Screen name="EventView" />
      <Stack.Screen name="EventAttendance" />
      <Stack.Screen name="CreateGameSession" />
    </Stack>
  );
}