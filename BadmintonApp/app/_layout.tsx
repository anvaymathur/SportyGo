import { Stack } from "expo-router";
import { Auth0Provider } from "react-native-auth0";
import config from '../tamagui.config'
import React from "react";
import { TamaguiProvider } from "tamagui";

export default function RootLayout() {
  return (
    <Auth0Provider
      domain="dev-6oulj204w6qwe4dk.us.auth0.com"
      clientId="CHYISQSTA3BStcmW4Yrz9ThiLV0PFUdv">
      <TamaguiProvider config={config}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(userSetup)" redirect={true} />
          <Stack.Screen name="index"/>
          <Stack.Screen name="EventsList" options={{ title: "Events List"}} />
          <Stack.Screen name="EventView" options={{ title: "Event Details" }} />
          <Stack.Screen name="CreateGameSession" options={{ title: "Create Event" }} />
        </Stack>
      </TamaguiProvider>
    </Auth0Provider>
  );
}
