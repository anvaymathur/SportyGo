import { useEffect, useState } from 'react';
import { useAuth0 } from 'react-native-auth0';
import { router } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import React from 'react';

export default function Index() {
  const { user, isLoading } = useAuth0();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (!isLoading && initializing) {
      setInitializing(false);
      if (user) {
        router.replace('/tabs/profile' ); 
      } else {
        router.replace('/auth/login');
      }
    }
  }, [user, isLoading, initializing]);
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
