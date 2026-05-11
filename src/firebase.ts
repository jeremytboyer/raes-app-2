import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBZai8VfJTUCTn3i1Ccmq8BRv5fPolatxk",
  authDomain: "raes-app-2.firebaseapp.com",
  projectId: "raes-app-2",
  storageBucket: "raes-app-2.firebasestorage.app",
  messagingSenderId: "788603429517",
  appId: "1:788603429517:web:3c8a80dc44ff383c22b8c4",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
