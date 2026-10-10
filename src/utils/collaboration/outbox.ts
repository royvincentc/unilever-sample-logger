import { openDB } from 'idb';
import type { Operation, Conflict, Resource } from '../../types/collaboration';
const database = () => openDB('SampleLoggerCollaboration', 1, { upgrade(db) { db.createObjectStore('sessions'); } });
export interface StoredSession { pending: Operation[]; conflicts: Conflict[]; snapshot?: Resource }
export const sessionKey = (uid: string, workspace: string, resource: string) => `${uid}:${workspace}:${resource}`;
export async function readSession(key: string): Promise<StoredSession> { const db = await database(); try { return await db.get('sessions',key) || { pending:[], conflicts:[] }; } finally { db.close(); } }
export async function writeSession(key: string, value: StoredSession) { const db = await database(); try { await db.put('sessions',value,key); } finally { db.close(); } }
