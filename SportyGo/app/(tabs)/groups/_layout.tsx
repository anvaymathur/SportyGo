import { Stack, useNavigation, usePathname } from "expo-router";
import React, { useEffect } from "react";

export default function GroupLayout() {
  const navigation = useNavigation();
  const pathname = usePathname();

  useEffect(() => {
    const shouldHide =
      pathname?.endsWith('/viewMembers') ||
      pathname?.endsWith('/createGroup') ||
      pathname?.includes('/addMembers');

    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: shouldHide ? { display: 'none' } : undefined });
  }, [navigation, pathname]);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="displayGroups" />
      <Stack.Screen name="createGroup" />
      <Stack.Screen name="index" />
      <Stack.Screen name="viewMembers" />
      <Stack.Screen name="[inviteCode]" />
      <Stack.Screen name="addMembers" />
    </Stack>
  );
}
