import type { VercelRequest } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { supabase } from './_supabase.js';
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function identity(req: VercelRequest) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Sign in with your Google account to use collaboration.');
  if (!getApps().some(app => app.name === 'collaboration')) {
    const raw = process.env.FIREBASE_ADMIN_CREDENTIALS;
    if (!raw || !process.env.FIREBASE_PROJECT_ID) throw new HttpError(503, 'Collaboration identity is not configured.');
    initializeApp({ credential: cert(JSON.parse(raw)), projectId: process.env.FIREBASE_PROJECT_ID }, 'collaboration');
  }
  try {
    const token = await getAuth(getApps().find(app => app.name === 'collaboration')!).verifyIdToken(header.slice(7), true);
    if (token.firebase.sign_in_provider !== 'google.com' || token.email_verified !== true) throw new HttpError(403, 'A verified Google identity is required.');
    return { uid: token.uid, name: String(token.name || token.email || 'Member').slice(0, 100) };
  } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(401, 'Your session expired. Sign in again.'); }
}
export async function membership(req: VercelRequest, write = false, admin = false) {
  const user = await identity(req);
  if (!supabase) throw new HttpError(503, 'Collaboration storage is not configured.');
  const workspaceId = String(req.query.workspace || req.body?.workspaceId || process.env.COLLABORATION_WORKSPACE_ID || '');
  const { data, error } = await supabase.from('collab_memberships').select('workspace_id, role').eq('workspace_id', workspaceId).eq('uid', user.uid).eq('active', true).maybeSingle();
  if (error) throw new HttpError(503, 'Collaboration database needs setup.');
  if (!data || write && data.role === 'viewer' || admin && data.role !== 'admin') throw new HttpError(403, 'Your workspace role does not permit this action.');
  return { ...user, workspaceId, role: data.role as 'admin' | 'editor' | 'viewer' };
}
export function safeFailure(error: unknown) { return error instanceof HttpError ? { status: error.status, message: error.message } : { status: 500, message: 'The request could not be saved. Your pending draft is retained.' }; }
