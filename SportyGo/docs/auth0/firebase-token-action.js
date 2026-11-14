/**
 * Auth0 Action: Login / Post Login  ("Firebase sign-in token")
 *
 * Mints a Firebase custom token for the person logging in and adds it to their Auth0 ID token.
 * The app signs in to Firebase with it (utils/firebaseSession.ts), which gives Firestore
 * security rules a real identity: request.auth.uid == the Auth0 user ID.
 *
 * Runs on every login and every refresh-token exchange. Setup: docs/FIREBASE_AUTH_SETUP.md
 *
 * Dependency (Actions editor > Dependencies):  jsonwebtoken (latest)
 * Secrets (Actions editor > Secrets), both from the Firebase service-account key JSON:
 *   FIREBASE_CLIENT_EMAIL   the "client_email" value
 *   FIREBASE_PRIVATE_KEY    the "private_key" value, pasted exactly as it appears in the file
 */
const jwt = require('jsonwebtoken');

// Must match FIREBASE_TOKEN_CLAIM in the app (utils/firebaseSession.ts)
const CLAIM = 'https://sportygo.ca/firebase_token';
const FIREBASE_AUDIENCE =
  'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

exports.onExecutePostLogin = async (event, api) => {
  const clientEmail = event.secrets.FIREBASE_CLIENT_EMAIL;
  // Pasted keys keep their line breaks as the two characters "\n"
  const privateKey = (event.secrets.FIREBASE_PRIVATE_KEY || '').replace(/\n/g, '\n');
  if (!clientEmail || !privateKey) {
    console.log('Firebase token skipped: secrets are not set');
    return;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      {
        iss: clientEmail,
        sub: clientEmail,
        aud: FIREBASE_AUDIENCE,
        iat: now,
        exp: now + 3600, // the longest Firebase allows; the app uses it straight away
        uid: event.user.user_id,
      },
      privateKey,
      { algorithm: 'RS256' }
    );
    api.idToken.setCustomClaim(CLAIM, token);
  } catch (error) {
    // Never block a login over this; the app asks the person to log in again if needed
    console.log('Firebase token failed: ' + error.message);
  }
};
