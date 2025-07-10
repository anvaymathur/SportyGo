import { useEffect } from 'react';
import { useAuth0 } from 'react-native-auth0';
import { Href, router } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

export default function Index() {
  const { user, isLoading } = useAuth0();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/(tabs)' as Href);
      } else {
        router.replace('/(auth)/login' as Href);
      }
    }
  }, [user, isLoading]);

  // Show loading screen while checking authentication
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  text: {
    fontSize: 16,
  },
});
