import { Stack } from "expo-router";
import { Auth0Provider } from "react-native-auth0";
import config from '../tamagui.config'
import React from "react";
import { TamaguiProvider, Theme } from "tamagui";
import { UserProvider } from "./components/userContext";


export default function RootLayout() {
  return (
    <Auth0Provider
      domain="dev-6oulj204w6qwe4dk.us.auth0.com"
      clientId="CHYISQSTA3BStcmW4Yrz9ThiLV0PFUdv">
        <UserProvider>
          <TamaguiProvider config={config}>
            <Theme name="earthy-sport-light">
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(userSetup)" redirect={true} />
                <Stack.Screen name="(groups)" redirect={true}/>
                <Stack.Screen name="(matchHistory)" redirect={true} />
                <Stack.Screen name="index"/>
                <Stack.Screen name="EventsList"/>
                <Stack.Screen name="EventView"/>
                <Stack.Screen name="CreateGameSession"/>
                <Stack.Screen name="EventAttendance"/>
              </Stack>
            </Theme>
          </TamaguiProvider>
        </UserProvider>
    </Auth0Provider>
  );
}
