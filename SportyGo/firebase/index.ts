/**
 * Firebase Configuration and Initialization
 */

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
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

export { app, db, storage };