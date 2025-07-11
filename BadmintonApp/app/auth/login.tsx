import { Text, View, StyleSheet, Button, Alert } from "react-native";
import { useAuth0, User } from 'react-native-auth0';
import { Href, router } from 'expo-router';
import React, { useEffect } from "react";


export default function LoginScreen() {
    const { authorize, user, error, isLoading, clearSession } = useAuth0();

    useEffect(() => {
        if (user) {
          router.replace('/(tabs)' as Href);
        }
      }, [user]);

    const onLogin = async () => {
        try {
            console.log("Starting authorize()");
            await authorize();
        } catch (e) {
            Alert.alert('Error', 'Failed to login');
            console.log(e);
        }
    }

    const onLogout = async () => {
        try {
            await clearSession();
        }
        catch (e) {
            Alert.alert('Error', 'Failed to logout');
            console.log(e);
        }
    }

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
      <Button onPress={onLogout} title="Log Out" />
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
    
function useEffect(arg0: () => void, arg1: (User | null)[]) {
    throw new Error("Function not implemented.");
}

