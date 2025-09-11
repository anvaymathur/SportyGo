import { useContext, useEffect, useState } from 'react';
import { useAuth0 } from 'react-native-auth0';
import { router } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import React from 'react';
import { UserContext } from './components/userContext'
import { getUserProfile } from '../firebase/services_firestore2'
import { SafeAreaWrapper } from './components/SafeAreaWrapper'

export default function Index() {
  const { user, isLoading } = useAuth0();
  const [initializing, setInitializing] = useState(true);
  const {globalUser, saveUser} = useContext(UserContext)
   
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user && user.sub) {
        const userProfile = await getUserProfile(user.sub)
        if (userProfile) {
          saveUser({name: userProfile.Name, email: userProfile.Email})
        }
      }
    }
    if (!isLoading && initializing) {
      
      setInitializing(false);

      if (user && user.sub) {
        fetchUserProfile()
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isLoading, initializing]);
  return (
    <SafeAreaWrapper backgroundColor="#F5FCFF">
      <View style={styles.container}>
        <Text style={styles.text}>Loading...</Text>
      </View>
    </SafeAreaWrapper>
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
