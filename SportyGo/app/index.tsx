import React, { useContext, useEffect, useState } from 'react';
import { useAuth0 } from 'react-native-auth0';
import { router } from 'expo-router';
import { YStack, Text, Spinner, Button } from 'tamagui';
import { UserContext } from '@/components/userContext'
import { getUserProfile } from '../firebase/services_firestore2'
import { findTempsToOffer } from '@/utils/claimPrompts'
import { SafeAreaWrapper } from '@/components/SafeAreaWrapper'

export default function Index() {
  const { user, isLoading } = useAuth0();
  const [initializing, setInitializing] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const { saveUser } = useContext(UserContext)

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.sub) {
        router.replace('/login');
        return;
      }
      try {
        const userProfile = await getUserProfile(user.sub)
        if (!userProfile) {
          router.replace('/login');
          return;
        }
        saveUser({name: userProfile.Name, email: userProfile.Email})
        // Detect claimable temp users before routing to dashboard; not worth blocking launch over
        const claimable = await findTempsToOffer(user.sub, userProfile.Email, userProfile.Phone).catch(() => []);
        if (claimable.length > 0) {
          router.replace({ pathname: '/claimTempUsers' as any, params: { ids: JSON.stringify(claimable.map(t => t.id)) } });
        } else {
          router.replace('/dashboard');
        }
      } catch (error) {
        // Usually offline; without this the app sits on the spinner forever
        console.error('Error loading user profile:', error);
        setLoadFailed(true);
      }
    }
    if (!isLoading && initializing) {
      setInitializing(false);
      fetchUserProfile()
    }
  }, [user, isLoading, initializing, saveUser]);

  const retry = () => {
    setLoadFailed(false);
    setInitializing(true);
  };

  return (
    <SafeAreaWrapper backgroundColor="$background">
      <YStack flex={1} p="$4" gap="$2" justify="center" items="center">
        {loadFailed ? (
          <>
            <Text color="$color" fontSize="$5">Couldn&apos;t load your profile</Text>
            <Text color="$color10">Check your connection and try again.</Text>
            <Button mt="$3" bg="$color9" color="$color1" onPress={retry}>Try again</Button>
          </>
        ) : (
          <>
            <Spinner size="large" color="$color9" />
            <Text color="$color10">Loading…</Text>
          </>
        )}
      </YStack>
    </SafeAreaWrapper>
  );
}
