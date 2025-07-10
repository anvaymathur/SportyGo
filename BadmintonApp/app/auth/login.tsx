import { Text, View, StyleSheet, Button, Alert } from "react-native";
import { useAuth0 } from 'react-native-auth0';
import { Href, router } from 'expo-router';
import { useEffect } from 'react';


export default function LoginScreen() {
    const { authorize, user, error, isLoading } = useAuth0();

    useEffect(() => {
        if (user) {
          router.replace('/(tabs)' as Href);
        }
      }, [user]);

    const onLogin = async () => {
        try {
            await authorize()
        } catch (e) {
            Alert.alert('Error', 'Failed to login');
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
    
