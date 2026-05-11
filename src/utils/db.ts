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
const DB_VERSION = 1;

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
        // We'll keep local queue as a secondary fallback, but Firestore is primary
        if (!db.objectStoreNames.contains('queue')) {
          const queueStore = db.createObjectStore('queue', { keyPath: 'id' });
          queueStore.createIndex('status', 'status');
        }
        if (!db.objectStoreNames.contains('history')) {
          db.createObjectStore('history', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// ===== FIREBASE SYNC HELPERS =====

export function listenToHistory(callback: (entries: HistoryEntry[]) => void) {
  const q = query(collection(firestore, 'history'), orderBy('submittedAt', 'desc'), fsLimit(100));
  return onSnapshot(q, 
    (snapshot) => {
      const entries: HistoryEntry[] = [];
      snapshot.forEach((doc) => {
        entries.push(doc.data() as HistoryEntry);
      });
      callback(entries);
      updateLocalCache(entries);
    },
    (error) => {
      console.error("Firestore Listen Error:", error);
    }
  );
}

async function updateLocalCache(entries: HistoryEntry[]) {
  const db = await getDB();
  const tx = db.transaction('history', 'readwrite');
  for (const entry of entries) {
    await tx.store.put(entry);
  }
  await tx.done;
}

// ===== QUEUE OPERATIONS (Local + Firebase Fallback) =====
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

// ===== HISTORY OPERATIONS (Firestore Primary) =====

export async function addToHistory(entry: HistoryEntry): Promise<void> {
  // 1. Save to Local Cache (Always do this first for speed/reliability)
  const db = await getDB();
  await db.put('history', entry);

  // 2. Try to save to Firestore in the background
  try {
    const cleanedEntry = cleanForFirestore(entry);
    const docRef = doc(firestore, 'history', entry.id);
    await setDoc(docRef, cleanedEntry);
    console.log(`Successfully saved entry ${entry.id} to Firestore`);
  } catch (e) {
    console.error('Firestore save error:', e);
    // We don't throw here so the user can continue
  }
}

export async function updateHistory(entry: HistoryEntry): Promise<void> {
  await addToHistory(entry);
}

export async function getHistory(limitCount = 50): Promise<HistoryEntry[]> {
  try {
    // Try Firestore first
    const q = query(collection(firestore, 'history'), orderBy('submittedAt', 'desc'), fsLimit(limitCount));
    const snapshot = await getDocs(q);
    const entries: HistoryEntry[] = [];
    snapshot.forEach((doc) => {
      entries.push(doc.data() as HistoryEntry);
    });
    
    if (entries.length > 0) {
      updateLocalCache(entries); // Keep cache fresh
      return entries;
    }
  } catch (e) {
    console.warn('Firestore fetch failed, using local cache:', e);
  }

  // Fallback to local cache
  const db = await getDB();
  const all = await db.getAll('history');
  return all
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, limitCount);
}

export async function importHistoryBatch(entries: HistoryEntry[]): Promise<void> {
  // Used for Google Sheets sync reconciliation
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
  const db = await getDB();
  const allHistory = await db.getAll('history');
  const allQueue = await db.getAll('queue');
  
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
  const db = await getDB();
  await db.clear('history');
}

