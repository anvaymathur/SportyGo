import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { useAuth0 } from 'react-native-auth0';

export default function HomeScreen() {
  const { user } = useAuth0();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to BadmintonApp</Text>
      <Text style={styles.subtitle}>Home Screen</Text>
      {user && (
        <Text style={styles.userInfo}>
          Hello, {user.name || user.email}!
        </Text>
      )}
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
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
    color: '#666',
  },
  userInfo: {
    fontSize: 16,
    color: '#333',
  },
});
