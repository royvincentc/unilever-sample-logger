import type { VercelRequest } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { supabase } from './_supabase.js';
import { firebaseIdentityConfig } from './_firebaseIdentityConfig.js';
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function identity(req: VercelRequest) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Sign in with your Google account to use collaboration.');
  if (!getApps().some(app => app.name === 'collaboration')) {
    try {
      const config = firebaseIdentityConfig(process.env);
      initializeApp({ credential: cert(config.credentials), projectId: config.projectId }, 'collaboration');
    } catch { throw new HttpError(503, 'Shared workspace setup is incomplete. Your administrator must configure Firebase server credentials.'); }
  }
  try {
    const token = await getAuth(getApps().find(app => app.name === 'collaboration')!).verifyIdToken(header.slice(7), true);
    if (token.firebase.sign_in_provider !== 'google.com' || token.email_verified !== true) throw new HttpError(403, 'A verified Google identity is required.');
    return { uid: token.uid, name: String(token.name || token.email || 'Member').slice(0, 100) };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const code = (error as { code?: string }).code;
    if (['auth/insufficient-permission', 'auth/invalid-credential', 'auth/internal-error', 'app/invalid-credential', 'app/network-error'].includes(code || '')) throw new HttpError(503, 'Shared workspace identity service is unavailable. Your administrator must check Firebase server credentials and permissions.');
    throw new HttpError(401, 'Your session expired. Sign in again.');
  }
}
export async function membership(req: VercelRequest, write = false, admin = false) {
  const user = await identity(req);
  if (!supabase) throw new HttpError(503, 'Collaboration storage is not configured.');
  const workspaceId = String(req.query.workspace || req.body?.workspaceId || process.env.COLLABORATION_WORKSPACE_ID || '');
  if (!workspaceId) throw new HttpError(503, 'Shared workspace setup is incomplete. Your administrator must configure the workspace.');
  const { data, error } = await supabase.from('collab_memberships').select('workspace_id, role').eq('workspace_id', workspaceId).eq('uid', user.uid).eq('active', true).maybeSingle();
  if (error) throw new HttpError(503, 'Collaboration database needs setup.');
  if (!data) throw new HttpError(403, 'Your Google account is signed in but has not been added to this workspace. Ask your administrator for access.');
  if (write && data.role === 'viewer' || admin && data.role !== 'admin') throw new HttpError(403, 'Your workspace role does not permit this action.');
  return { ...user, workspaceId, role: data.role as 'admin' | 'editor' | 'viewer' };
}
export function safeFailure(error: unknown) { return error instanceof HttpError ? { status: error.status, message: error.message } : { status: 500, message: 'The request could not be saved. Your pending draft is retained.' }; }
