import { Stack, Tabs} from "expo-router";
import { Auth0Provider } from "react-native-auth0";
import config from '../tamagui.config'
import React from "react";
import { TamaguiProvider, Theme } from "tamagui";
import { UserProvider } from "./components/userContext";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PortalProvider } from '@tamagui/portal';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Auth0Provider
        domain="dev-6oulj204w6qwe4dk.us.auth0.com"
        clientId="CHYISQSTA3BStcmW4Yrz9ThiLV0PFUdv">
          <UserProvider>
            <TamaguiProvider config={config}>
              <PortalProvider shouldAddRootHost>
                <Theme name="earthy-sport-light">
                 <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index"  />
                  <Stack.Screen name="(tabs)" />
                 </Stack>
                </Theme>
              </PortalProvider>
            </TamaguiProvider>
          </UserProvider>
      </Auth0Provider>
    </SafeAreaProvider>
  );
}
