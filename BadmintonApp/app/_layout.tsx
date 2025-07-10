import { Stack } from "expo-router";
import { Auth0Provider } from "react-native-auth0";

export default function RootLayout() {
  return (
    <Auth0Provider
      domain="dev-6oulj204w6qwe4dk.us.auth0.com"
      clientId="CHYISQSTA3BStcmW4Yrz9ThiLV0PFUdv"
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)"/>
        <Stack.Screen name="(tabs)"/>
        <Stack.Screen name="index"/>
      </Stack>
    </Auth0Provider>
  );
}
