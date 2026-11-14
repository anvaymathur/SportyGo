import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from '../firebase/index';

/**
 * Firebase sign-in for an Auth0 user.
 *
 * People log in with Auth0, but Firestore security rules only recognise Firebase identities.
 * An Auth0 post-login Action (docs/auth0/firebase-token-action.js) mints a Firebase custom
 * token for the user and puts it in the Auth0 ID token under FIREBASE_TOKEN_CLAIM. The app
 * signs in to Firebase with it, so Firestore sees `request.auth.uid` = the Auth0 user ID.
 * Firebase then keeps its own session on the device, so the exchange is only needed after a
 * fresh login (or when that session is lost).
 */
export const FIREBASE_TOKEN_CLAIM = 'https://sportygo.ca/firebase_token';

/** Same shape as `getCredentials` from react-native-auth0's `useAuth0()`. */
export type GetCredentials = (
  scope?: string,
  minTtl?: number,
  parameters?: Record<string, unknown>,
  forceRefresh?: boolean
) => Promise<{ idToken?: string } | undefined>;

/** Reads the Firebase custom token out of an Auth0 ID token, or null if it has none. */
export function readFirebaseToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const claim = JSON.parse(globalThis.atob(padded))[FIREBASE_TOKEN_CLAIM];
    return typeof claim === 'string' && claim.length > 0 ? claim : null;
  } catch {
    return null;
  }
}

/**
 * Makes sure Firebase is signed in as `userId`. Returns false when that isn't possible (the
 * Auth0 Action isn't deployed yet, or this login predates it and can't be refreshed); the
 * caller carries on, and if Firestore then refuses the request the user is asked to log in
 * again, which always produces a fresh token.
 */
export async function ensureFirebaseSession(userId: string, getCredentials: GetCredentials): Promise<boolean> {
  try {
    await auth.authStateReady();
    if (auth.currentUser?.uid === userId) return true;
    // A different person's session left on this device
    if (auth.currentUser) await signOut(auth);
  } catch (e) {
    console.warn('Firebase session check failed', e);
  }

  // The token in the stored ID token is only valid for an hour after it was issued, so if the
  // stored one is missing or stale, ask Auth0 for a new ID token and try once more.
  let sawToken = false;
  for (const forceRefresh of [false, true]) {
    try {
      const credentials = await getCredentials(undefined, undefined, undefined, forceRefresh);
      const token = readFirebaseToken(credentials?.idToken);
      if (!token) continue;
      sawToken = true;
      const result = await signInWithCustomToken(auth, token);
      if (result.user.uid === userId) {
        console.log('Firebase sign-in OK for', userId);
        return true;
      }
      console.warn('Firebase sign-in: token was for a different user', result.user.uid);
      await signOut(auth);
    } catch (e) {
      console.warn(`Firebase sign-in failed${forceRefresh ? ' after refresh' : ''}`, e);
    }
  }
  if (!sawToken) {
    // Setup problem, not a network one: see docs/FIREBASE_AUTH_SETUP.md step 3
    console.warn(
      'Firebase sign-in skipped: the Auth0 ID token has no Firebase token. Check the Auth0 Action is ' +
      'deployed and in the Login flow, then log out and back in.'
    );
  }
  return false;
}

/** Ends the Firebase session (on sign-out and account deletion). Never throws. */
export async function endFirebaseSession(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Firebase sign-out failed', e);
  }
}

/** True when Firestore refused a request because of its security rules. */
export function isPermissionDenied(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'permission-denied';
}
