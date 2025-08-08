import { Stack } from "expo-router";
import React from "react";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="addScore" />
      <Stack.Screen name="viewScore" />
      <Stack.Screen name="dashboard" />

    </Stack>
  );
}
