import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc } from "firebase/firestore";

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

async function clearHistoryFast() {
  console.log("Fetching history...");
  const snapshot = await getDocs(collection(db, "history"));
  console.log(`Found ${snapshot.size} records. Deleting in batches...`);
  
  let batch = writeBatch(db);
  let count = 0;
  for (const document of snapshot.docs) {
    batch.delete(doc(db, "history", document.id));
    count++;
    if (count % 400 === 0) {
      await batch.commit();
      console.log(`Deleted ${count} records...`);
      batch = writeBatch(db);
    }
  }
  if (count % 400 !== 0) {
    await batch.commit();
  }
  
  console.log(`Successfully deleted ${count} records.`);
  process.exit(0);
}

clearHistoryFast();
