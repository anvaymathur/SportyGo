import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: false,
          title: "Events List"
        }} 
      />
      <Stack.Screen 
        name="EventsList" 
        options={{ 
          headerShown: false,
          title: "Events List"
        }} 
      />
      <Stack.Screen 
        name="EventView" 
        options={{ 
          headerShown: false,
          title: "Event Details"
        }} 
      />
      <Stack.Screen 
        name="CreateGameSession" 
        options={{ 
          headerShown: false,
          title: "Create Event"
        }} 
      />
    </Stack>
  );
}
