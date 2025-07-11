import * as WebBrowser from 'expo-web-browser';
console.log("maybeCompleteAuthSession in app/_layout.tsx: ",WebBrowser.maybeCompleteAuthSession());

import { Stack } from "expo-router";
import { Auth0Provider } from "react-native-auth0";

import React from "react";



export default function RootLayout() {
  return (
    <Auth0Provider
      domain="dev-6oulj204w6qwe4dk.us.auth0.com"
      clientId="CHYISQSTA3BStcmW4Yrz9ThiLV0PFUdv"
    >
      <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" redirect={true} />
      <Stack.Screen name="(tabs)" redirect={true} />
        <Stack.Screen name="index"/>
      </Stack>
    </Auth0Provider>
  );
}
