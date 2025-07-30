import { Text, View, StyleSheet, Button } from "react-native";
import { useAuth0 } from 'react-native-auth0';
import { router } from 'expo-router';
import React, { useEffect } from "react";


export default function LoginScreen() {
  const { authorize, user, error, isLoading, clearSession } = useAuth0();

  useEffect(() => {
    if (!isLoading && user) {
      console.log("user:", user);
      router.replace('/userSetup/setupProfile');
    }
  }, [user, isLoading]);
  
  const onLogin = async () => {
    try {
      await authorize();   
    } catch (e) {
      console.error(e);
    }
  };

  const onLogout = async () => {
    try {
      await clearSession();
      // router.replace('/userSetup/login' );
    } catch (e) {
      console.log('Logout error:', e);
    }
  };

  if (isLoading) {
      return (
          <View style={styles.container}>
              <Text>Loading...</Text>
          </View>
      )
  }
    
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to BadmintonApp</Text>
      <Text>You are not logged in</Text>
      <Button onPress={onLogin} title="Log In" />
      {error && <Text style={styles.error}>{error.message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  error: {
    color: 'red',
    marginTop: 10,
  },
});

