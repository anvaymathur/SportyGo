/**
 * Firebase Configuration and Initialization
 */

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import * as firebaseAuth from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * Firebase configuration object
 */
const firebaseConfig = {
  apiKey: "AIzaSyDNRdu6tBcISIROkVWW1VvrTE8ChBaZxck",
  authDomain: "sportygo-sparkpro.firebaseapp.com",
  projectId: "sportygo-sparkpro",
  storageBucket: "sportygo-sparkpro.firebasestorage.app",
  messagingSenderId: "427835889208",
  appId: "1:427835889208:web:e42dea9065f9bfa2ecb8cd",
  measurementId: "G-EDTN4M9WFC"
};

const app = initializeApp(firebaseConfig);
if (Platform.OS === "web") {
  getAnalytics(app);
}

const db = getFirestore(app);
const storage = getStorage(app);


// Firebase identity for Firestore security rules. The app signs in here with a custom token
// minted at Auth0 login (see utils/firebaseSession.ts and docs/FIREBASE_AUTH_SETUP.md).
// getReactNativePersistence only exists in the React Native build of firebase/auth, which is
// what Metro bundles on iOS/Android; its web typings don't list it.
const getReactNativePersistence = (firebaseAuth as any).getReactNativePersistence;
const auth: firebaseAuth.Auth =
  Platform.OS === "web" || !getReactNativePersistence
    ? firebaseAuth.getAuth(app)
    : firebaseAuth.initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

export { app, db, storage, auth };