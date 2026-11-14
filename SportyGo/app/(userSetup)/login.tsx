import React, { useContext, useEffect, useState } from "react";
import { useAuth0 } from 'react-native-auth0';
import { router } from 'expo-router';
import { YStack, Card, Button, Text, Paragraph, H3, Spinner } from 'tamagui';
import { UserContext } from "@/components/userContext";
import { getUserProfile } from "../../firebase/services_firestore2";
import { findTempsToOffer } from "@/utils/claimPrompts";
import { SafeAreaWrapper } from "@/components/SafeAreaWrapper";
import { ensureFirebaseSession, isPermissionDenied } from "@/utils/firebaseSession";

// offline_access gets a refresh token, so the Firebase sign-in token can be renewed without a new login
const AUTH_SCOPE = 'openid profile email offline_access';


export default function LoginScreen() {
  const { authorize, user, isLoading, getCredentials, clearCredentials } = useAuth0();
  const { saveUser } = useContext(UserContext);
  const [navigating, setNavigating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user) {
      setNavigating(true);
      (async () => {
        try {
          await ensureFirebaseSession(user.sub ?? "", getCredentials);
          const userProfile = await getUserProfile(user.sub ?? "");
          if (userProfile) {
            saveUser({ name: userProfile.Name, email: userProfile.Email });
            // Detect claimable temp users before routing to dashboard
            const claimable = await findTempsToOffer(user.sub ?? "", userProfile.Email, userProfile.Phone);
            if (claimable.length > 0) {
              router.replace({ pathname: '/claimTempUsers' as any, params: { ids: JSON.stringify(claimable.map(t => t.id)) } });
            } else {
              router.replace('/dashboard');
            }
          } else {
            router.replace('/setupProfile');
          }
        } catch (e) {
          console.error('Login: profile lookup failed', e);
          if (isPermissionDenied(e)) {
            // Drop the stored login so the next attempt starts clean instead of looping here
            await clearCredentials().catch(() => undefined);
            setNotice("We couldn't finish signing you in. Please log in again.");
          } else {
            setNotice("Couldn't load your profile. Check your connection and try again.");
          }
          setNavigating(false);
        }
      })();
    }
    // Runs once per login; the Auth0 helpers aren't stable between renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading]);
  
  const onLogin = async () => {
    setNotice(null);
    try {
      await authorize({ scope: AUTH_SCOPE });
    } catch (e) {
      console.error(e);
    }
  };

  const onSignup = async () => {
    setNotice(null);
    try {
      await authorize({
        scope: AUTH_SCOPE,
        additionalParameters: {
          screen_hint: 'signup'
        }
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading || navigating) {
      return (
        <SafeAreaWrapper backgroundColor="$background">
          <YStack flex={1} p="$4" gap="$2" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Spinner size="large" color="$color9" />
            <Text color="$color10">{user ? 'Signing you in…' : 'Loading…'}</Text>
          </YStack>
        </SafeAreaWrapper>
      )
  }
    
  return (
    <SafeAreaWrapper backgroundColor="$background">
      <YStack flex={1} p="$4" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Card elevate bordered p="$5" borderWidth={1} borderColor="$borderColor" width="100%" style={{ maxWidth: 420, alignItems: 'center' }}>
          <YStack width="100%" gap="$3" style={{ alignItems: 'center' }}>
            <H3 color="$color" style={{ textAlign: 'center' }}>Welcome to SportyGo</H3>
            <Paragraph color="$color10" style={{ textAlign: 'center' }}>
              Track matches, manage groups, and compete with ease.
            </Paragraph>
            {notice ? (
              <Paragraph color="$danger" style={{ textAlign: 'center' }}>{notice}</Paragraph>
            ) : null}

            <YStack width="100%" gap="$3">
              <Button size="$5" bg="$color9" color="$color1" onPress={onLogin}>
                Log In
              </Button>

              <Button size="$5" bg="$color1" color="$color9" borderWidth={1} borderColor="$color9" onPress={onSignup}>
                Sign Up
              </Button>
            </YStack>
          </YStack>
        </Card>
      </YStack>
    </SafeAreaWrapper>
  );
}

