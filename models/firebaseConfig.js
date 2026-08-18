import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD1g8-ZcprajBHj_weH9llsXDhkdOvdzL0",
  authDomain: "mswdo-portal.firebaseapp.com",
  projectId: "mswdo-portal",
  storageBucket: "mswdo-portal.firebasestorage.app",
  messagingSenderId: "1083128420711",
  appId: "1:1083128420711:web:a20f7bd1cce921645037c2",
  measurementId: "G-QMD4RSJCDV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
