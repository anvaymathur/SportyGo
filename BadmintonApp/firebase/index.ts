// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA0PhuQlmcb_-CBQ9-FkNVSZY1yEG8do2c",
  authDomain: "badmintonapp-c1b33.firebaseapp.com",
  projectId: "badmintonapp-c1b33",
  storageBucket: "badmintonapp-c1b33.firebasestorage.app",
  messagingSenderId: "893581034585",
  appId: "1:893581034585:web:8e4d07eaec6a9e151f5d48",
  measurementId: "G-34P8MQKBV0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

const db = getFirestore(app);

export { app, db };