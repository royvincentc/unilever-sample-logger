import { openDB, type IDBPDatabase } from 'idb';
import type { QueueItem, HistoryEntry } from '../types';
import { db as firestore } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit as fsLimit, 
  onSnapshot,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';

const DB_NAME = 'SampleLoggerDB';
const DB_VERSION = 2; // Incremented version to ensure fresh DB structure if needed

// Helper to remove undefined values for Firestore
function cleanForFirestore(obj: any): any {
  const result: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // We strictly only use IndexedDB for the offline queue now. 
        // History is 100% driven by Firestore to ensure a single source of truth.
        if (!db.objectStoreNames.contains('queue')) {
          const queueStore = db.createObjectStore('queue', { keyPath: 'id' });
          queueStore.createIndex('status', 'status');
        }
      },
    });
  }
  return dbPromise;
}

// ===== FIREBASE SYNC HELPERS =====

export function listenToHistory(callback: (entries: HistoryEntry[]) => void) {
  const q = query(collection(firestore, 'history'), orderBy('submittedAt', 'desc'), fsLimit(5000));
  return onSnapshot(q, 
    (snapshot) => {
      const entries: HistoryEntry[] = [];
      snapshot.forEach((doc) => {
        entries.push(doc.data() as HistoryEntry);
      });
      callback(entries);
    },
    (error) => {
      console.error("Firestore Listen Error:", error);
    }
  );
}

// ===== QUEUE OPERATIONS (Local) =====
export async function addToQueue(item: QueueItem): Promise<void> {
  const db = await getDB();
  await db.put('queue', item);
}

export async function updateQueueItem(item: QueueItem): Promise<void> {
  const db = await getDB();
  await db.put('queue', item);
}

export async function clearQueue(): Promise<void> {
  const db = await getDB();
  await db.clear('queue');
}

export async function getQueueItems(): Promise<QueueItem[]> {
  const db = await getDB();
  return db.getAll('queue');
}

export async function getPendingQueueItems(): Promise<QueueItem[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex('queue', 'status', 'queued');
  return items;
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('queue', id);
}

// ===== HISTORY OPERATIONS (Firestore Primary - SSOT) =====

export async function addToHistory(entry: HistoryEntry): Promise<void> {
  try {
    const cleanedEntry = cleanForFirestore(entry);
    const docRef = doc(firestore, 'history', entry.id);
    await setDoc(docRef, cleanedEntry);
    console.log(`Successfully saved entry ${entry.id} to Firestore`);
  } catch (e) {
    console.error('Firestore save error:', e);
    throw e;
  }
}

export async function updateHistory(entry: HistoryEntry): Promise<void> {
  await addToHistory(entry);
}

export async function deleteFromHistory(id: string): Promise<void> {
  try {
    const docRef = doc(firestore, 'history', id);
    await deleteDoc(docRef);
    console.log(`Deleted entry ${id} from Firestore`);
  } catch (e) {
    console.error('Firestore delete error:', e);
    throw e;
  }
}

export async function getHistory(limitCount = 50): Promise<HistoryEntry[]> {
  try {
    const q = query(collection(firestore, 'history'), orderBy('submittedAt', 'desc'), fsLimit(limitCount));
    const snapshot = await getDocs(q);
    const entries: HistoryEntry[] = [];
    snapshot.forEach((doc) => {
      entries.push(doc.data() as HistoryEntry);
    });
    return entries;
  } catch (e) {
    console.error('Firestore fetch failed:', e);
    return [];
  }
}

export async function importHistoryBatch(entries: HistoryEntry[]): Promise<void> {
  const batch = writeBatch(firestore);
  for (const entry of entries) {
    if (entry.id) {
      const docRef = doc(firestore, 'history', entry.id);
      batch.set(docRef, entry, { merge: true });
    }
  }
  await batch.commit();
}

export async function getHighestLocalControlNumber(sampleType: string, dateStr: string): Promise<string | null> {
  // We query the queue first (local offline items)
  const db = await getDB();
  const allQueue = await db.getAll('queue');
  
  // And we query the live history
  const allHistory = await getHistory(100);
  
  const yearSuffix = new Date(dateStr).getFullYear().toString().slice(-2);
  let prefix = '';
  if (sampleType === 'ENVI') prefix = `E${yearSuffix}-`;
  else if (sampleType === 'WATER') prefix = `W${yearSuffix}-`;
  else if (sampleType === 'RawMats') prefix = `${yearSuffix}-`;

  const relevantHistory = allHistory.filter(entry => 
    entry.sampleType === sampleType && 
    entry.controlNumber && 
    entry.controlNumber.startsWith(prefix)
  );

  const relevantQueue = allQueue.filter(entry => 
    entry.sampleType === sampleType && 
    entry.controlNumber && 
    entry.controlNumber.startsWith(prefix)
  );

  const allRelevant = [
    ...relevantHistory.map(r => r.controlNumber),
    ...relevantQueue.map(r => r.controlNumber)
  ];
  
  if (allRelevant.length === 0) return null;

  allRelevant.sort((a, b) => {
    const aNum = parseInt(a!.split('-').pop() || '0', 10);
    const bNum = parseInt(b!.split('-').pop() || '0', 10);
    return bNum - aNum;
  });

  return allRelevant[0] || null;
}

export async function clearHistory(): Promise<void> {
  // Now deprecated as local history is removed
  console.warn("clearHistory called, but local history cache is deprecated.");
}

