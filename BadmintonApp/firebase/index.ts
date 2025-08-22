/**
 * Firebase Configuration and Initialization
 */

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

/**
 * Firebase configuration object
 */
const firebaseConfig = {
  apiKey: "AIzaSyA0PhuQlmcb_-CBQ9-FkNVSZY1yEG8do2c",
  authDomain: "badmintonapp-c1b33.firebaseapp.com",
  projectId: "badmintonapp-c1b33",
  storageBucket: "badmintonapp-c1b33.firebasestorage.app",
  messagingSenderId: "893581034585",
  appId: "1:893581034585:web:8e4d07eaec6a9e151f5d48",
  measurementId: "G-34P8MQKBV0"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { app, db };