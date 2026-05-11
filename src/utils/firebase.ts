import { initializeApp } from "firebase/app";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCxxViussq2eOVS1NtTrFDnzSsZCttKG0g",
  authDomain: "unilever-qc.firebaseapp.com",
  projectId: "unilever-qc",
  storageBucket: "unilever-qc.firebasestorage.app",
  messagingSenderId: "628633248559",
  appId: "1:628633248559:web:711cdffc89878c2cf0b7da",
  measurementId: "G-WBP9Z6MQ9K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable Offline Persistence with multi-tab support
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a a time.
        console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('Firestore persistence failed: Browser not supported');
    }
});

export default app;
