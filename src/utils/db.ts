import { openDB, type IDBPDatabase } from 'idb';
import type { QueueItem, HistoryEntry } from '../types';

const DB_NAME = 'SampleLoggerDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Submission queue store
        if (!db.objectStoreNames.contains('queue')) {
          const queueStore = db.createObjectStore('queue', { keyPath: 'id' });
          queueStore.createIndex('status', 'status');
          queueStore.createIndex('createdAt', 'createdAt');
        }
        // History store
        if (!db.objectStoreNames.contains('history')) {
          const historyStore = db.createObjectStore('history', { keyPath: 'id' });
          historyStore.createIndex('submittedAt', 'submittedAt');
          historyStore.createIndex('sampleType', 'sampleType');
        }
      },
    });
  }
  return dbPromise;
}

// ===== QUEUE OPERATIONS =====
export async function addToQueue(item: QueueItem): Promise<void> {
  const db = await getDB();
  await db.put('queue', item);
}

export async function getQueueItems(): Promise<QueueItem[]> {
  const db = await getDB();
  const items = await db.getAll('queue');
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getQueueItem(id: string): Promise<QueueItem | undefined> {
  const db = await getDB();
  return db.get('queue', id);
}

export async function updateQueueItem(item: QueueItem): Promise<void> {
  const db = await getDB();
  await db.put('queue', item);
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('queue', id);
}

export async function getPendingQueueItems(): Promise<QueueItem[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex('queue', 'status', 'queued');
  return items;
}

export async function getFailedQueueItems(): Promise<QueueItem[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex('queue', 'status', 'failed');
  return items;
}

// ===== HISTORY OPERATIONS =====
export async function addToHistory(entry: HistoryEntry): Promise<void> {
  const db = await getDB();
  await db.put('history', entry);
}

export async function updateHistory(entry: HistoryEntry): Promise<void> {
  const db = await getDB();
  await db.put('history', entry);
}

export async function cleanupOldHistory(): Promise<void> {
  const db = await getDB();
  const all = await db.getAll('history');
  
  // 14 days ago
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 14);
  const cutoffTime = cutoffDate.getTime();

  for (const entry of all) {
    if (new Date(entry.submittedAt).getTime() < cutoffTime) {
      await db.delete('history', entry.id);
    }
  }
}

export async function getHistory(limit = 50): Promise<HistoryEntry[]> {
  // Automatically cleanup old entries when accessing history
  await cleanupOldHistory();

  const db = await getDB();
  const all = await db.getAll('history');
  return all
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, limit);
}

export async function clearHistory(): Promise<void> {
  const db = await getDB();
  await db.clear('history');
}

export async function clearQueue(): Promise<void> {
  const db = await getDB();
  await db.clear('queue');
}

export async function importHistoryBatch(entries: HistoryEntry[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('history', 'readwrite');
  for (const entry of entries) {
    // Only import if it has a valid ID and submittedAt
    if (entry.id && entry.submittedAt) {
      await tx.store.put(entry);
    }
  }
  await tx.done;
}
