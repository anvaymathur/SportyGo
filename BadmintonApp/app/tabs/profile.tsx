import { Text, View, StyleSheet, Button } from "react-native";
import { useAuth0 } from 'react-native-auth0';
import { Href, router } from 'expo-router';
import React from "react";

export default function ProfileScreen() {
  const { user, clearSession } = useAuth0();

  const onLogout = async () => {
    try {
      await clearSession();
      router.replace('/auth/login' );
    } catch (e) {
      console.log('Logout error:', e);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      {user && (
        <>
          <Text>Name: {user.name || 'N/A'}</Text>
          <Text>Email: {user.email || 'N/A'}</Text>
        </>
      )}
      <Button onPress={onLogout} title="Log Out" />
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
});
