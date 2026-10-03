import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

/**
 * Signs the user out: clears everything cached on this device (profile, match history,
 * player caches), ends the Auth0 session, and returns to the login screen.
 */
export async function signOut(options: {
  clearUser: () => Promise<void>;
  clearSession: () => Promise<void>;
}): Promise<void> {
  try {
    await AsyncStorage.clear();
  } catch (e) {
    console.error('Failed to clear local data', e);
  }
  await options.clearUser();
  try {
    await options.clearSession();
  } catch (e) {
    // The browser sign-out can be cancelled; the app is still signed out locally
    console.warn('Auth0 sign-out did not complete', e);
  }
  router.replace('/login');
}
