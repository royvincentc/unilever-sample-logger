require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  await setDoc(doc(db, 'settings', 'sheet'), {
    spreadsheetId: '1yfoeCEFrL6AYftrmjcuAqsWU6Pu2bZ_mahaUvs9TzbI',
    updatedAt: new Date().toISOString()
  });
  console.log("Firebase settings updated!");
}

run().catch(console.error);
