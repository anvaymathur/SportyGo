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
 * Secrets (Actions editor > Secrets), either:
 *   FIREBASE_SERVICE_ACCOUNT  the whole service-account key JSON file, pasted as is  (easiest)
 * or both of:
 *   FIREBASE_CLIENT_EMAIL     the "client_email" value
 *   FIREBASE_PRIVATE_KEY      the "private_key" value
 * The key is accepted with or without its quotes, with "\n" sequences, real line breaks, or line
 * breaks that the secret box turned into spaces.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Must match FIREBASE_TOKEN_CLAIM in the app (utils/firebaseSession.ts)
const CLAIM = 'https://sportygo.ca/firebase_token';
const FIREBASE_AUDIENCE =
  'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

/** Rebuilds a PEM private key from however it was pasted. Returns null if it isn't one. */
function normalizePrivateKey(raw) {
  let text = String(raw || '').trim();
  // Pasted together with the JSON quotes (and maybe a trailing comma)
  text = text.replace(/,\s*$/, '').replace(/^"|"$/g, '');
  text = text.replace(/\\n/g, '\n');
  const match = text.match(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----([\s\S]*?)-----END \1-----/);
  if (!match) return null;
  // The body is base64; spaces or line breaks inside it don't matter, so re-wrap it cleanly
  const body = match[2].replace(/[^A-Za-z0-9+/=]/g, '');
  const lines = body.match(/.{1,64}/g) || [];
  return `-----BEGIN ${match[1]}-----\n${lines.join('\n')}\n-----END ${match[1]}-----\n`;
}

/** { clientEmail, privateKey } from the secrets, or an error message saying what is wrong. */
function readServiceAccount(secrets) {
  let clientEmail = secrets.FIREBASE_CLIENT_EMAIL;
  let rawKey = secrets.FIREBASE_PRIVATE_KEY;
  if (secrets.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const json = JSON.parse(secrets.FIREBASE_SERVICE_ACCOUNT);
      clientEmail = json.client_email;
      rawKey = json.private_key;
    } catch (e) {
      return { error: 'FIREBASE_SERVICE_ACCOUNT is not valid JSON; paste the whole key file' };
    }
  }
  clientEmail = String(clientEmail || '').trim().replace(/^"|"$/g, '');
  if (!clientEmail || !rawKey) return { error: 'secrets are not set' };
  if (!clientEmail.endsWith('.gserviceaccount.com')) {
    return { error: 'FIREBASE_CLIENT_EMAIL should end in .gserviceaccount.com (use "client_email")' };
  }
  const privateKey = normalizePrivateKey(rawKey);
  if (!privateKey) {
    return {
      error: 'FIREBASE_PRIVATE_KEY has no BEGIN/END PRIVATE KEY lines (use "private_key", not ' +
        '"private_key_id", and paste all of it)',
    };
  }
  try {
    crypto.createPrivateKey(privateKey);
  } catch (e) {
    return { error: 'FIREBASE_PRIVATE_KEY could not be read (' + e.message + '); paste it again in full' };
  }
  return { clientEmail, privateKey };
}

exports.onExecutePostLogin = async (event, api) => {
  const account = readServiceAccount(event.secrets || {});
  if (account.error) {
    console.log('Firebase token skipped: ' + account.error);
    return;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      {
        iss: account.clientEmail,
        sub: account.clientEmail,
        aud: FIREBASE_AUDIENCE,
        iat: now,
        exp: now + 3600, // the longest Firebase allows; the app uses it straight away
        uid: event.user.user_id,
      },
      account.privateKey,
      { algorithm: 'RS256' }
    );
    api.idToken.setCustomClaim(CLAIM, token);
    console.log('Firebase token added for ' + event.user.user_id);
  } catch (error) {
    // Never block a login over this; the app asks the person to log in again if needed
    console.log('Firebase token failed: ' + error.message);
  }
};

// Exposed for local tests only; Auth0 ignores extra exports
exports._normalizePrivateKey = normalizePrivateKey;
