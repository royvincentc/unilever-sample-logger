import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCxxViussq2eOVS1NtTrFDnzSsZCttKG0g",
  authDomain: "unilever-qc.firebaseapp.com",
  projectId: "unilever-qc",
  storageBucket: "unilever-qc.firebasestorage.app",
  messagingSenderId: "628633248559",
  appId: "1:628633248559:web:711cdffc89878c2cf0b7da",
  measurementId: "G-WBP9Z6MQ9K"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearHistory() {
  console.log("Fetching history...");
  const snapshot = await getDocs(collection(db, "history"));
  console.log(`Found ${snapshot.size} records. Deleting...`);
  
  let count = 0;
  for (const document of snapshot.docs) {
    await deleteDoc(doc(db, "history", document.id));
    count++;
  }
  
  console.log(`Successfully deleted ${count} records.`);
  process.exit(0);
}

clearHistory();
