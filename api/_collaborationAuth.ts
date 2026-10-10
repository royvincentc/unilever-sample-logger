import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { google } from 'googleapis';
import { supabase } from './_supabase.js';

const SESSION_COOKIE = 'collab_session';
const SESSION_MAX_AGE = 8 * 60 * 60;
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
type CollaborationUser = { uid: string; email: string; name: string };
type SessionPayload = CollaborationUser & { exp: number };

function oauthSettings() {
  const clientId = process.env.COLLAB_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.COLLAB_GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.COLLAB_GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri || !process.env.COLLAB_SESSION_SECRET) {
    throw new HttpError(503, 'Google sign-in is not configured for shared boards. Ask your administrator to configure the collaboration Google OAuth settings.');
  }
  return { clientId, clientSecret, redirectUri };
}

function sessionSecret() {
  const secret = process.env.COLLAB_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new HttpError(503, 'Google sign-in is not configured for shared boards. Ask your administrator to configure the collaboration session secret.');
  return secret;
}

function sign(value: string) {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

export function signSession(user: CollaborationUser) {
  const payload: SessionPayload = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

function readSignedPayload<T>(value: string | undefined): T | null {
  if (!value) return null;
  const [body, signature, extra] = value.split('.');
  if (!body || !signature || extra) return null;
  const expected = Buffer.from(sign(body));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T; } catch { return null; }
}

export function signedOAuthState(state: string, returnTo: string) {
  const body = Buffer.from(JSON.stringify({ state, returnTo, createdAt: Date.now() })).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifyOAuthState(value: string | undefined, expectedState: string) {
  const payload = readSignedPayload<{ state: string; returnTo: string; createdAt: number }>(value);
  if (!payload || payload.state !== expectedState || !Number.isFinite(payload.createdAt) || payload.createdAt > Date.now() + 30_000 || Date.now() - payload.createdAt > 10 * 60 * 1000) return null;
  return payload;
}

export function cookieValue(req: VercelRequest, name: string) {
  const cookies = req.headers.cookie || '';
  const pair = cookies.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  if (!pair) return undefined;
  try { return decodeURIComponent(pair.slice(name.length + 1)); } catch { return undefined; }
}

export function sessionCookie(value: string, maxAge = SESSION_MAX_AGE) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearOAuthStateCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `collab_oauth_state=; Path=/api/collaboration-auth; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function oauthStateCookie(value: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `collab_oauth_state=${encodeURIComponent(value)}; Path=/api/collaboration-auth; HttpOnly; SameSite=Lax; Max-Age=600${secure}`;
}

export function collaborationOAuthClient() {
  const settings = oauthSettings();
  return { client: new google.auth.OAuth2(settings.clientId, settings.clientSecret, settings.redirectUri), ...settings };
}

export function collaborationSession(req: VercelRequest): SessionPayload | null {
  const payload = readSignedPayload<SessionPayload>(cookieValue(req, SESSION_COOKIE));
  if (!payload || typeof payload.uid !== 'string' || !payload.uid || typeof payload.email !== 'string' || !payload.email || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function assertSameOrigin(req: VercelRequest) {
  const origin = req.headers.origin;
  if (typeof origin !== 'string') return;
  const forwardedHost = req.headers['x-forwarded-host'];
  const requestHost = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || req.headers.host;
  if (!requestHost) throw new HttpError(403, 'This request must come from the shared workspace.');
  try {
    if (new URL(origin).host.toLowerCase() !== String(requestHost).toLowerCase()) throw new HttpError(403, 'This request must come from the shared workspace.');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(403, 'This request must come from the shared workspace.');
  }
}

export async function identity(req: VercelRequest): Promise<CollaborationUser> {
  oauthSettings();
  const session = collaborationSession(req);
  if (!session) throw new HttpError(401, 'Sign in with Google to use shared boards.');
  return { uid: session.uid, email: session.email, name: String(session.name || session.email).slice(0, 100) };
}

export async function membership(req: VercelRequest, write = false, admin = false) {
  const user = await identity(req);
  if (req.method === 'POST') assertSameOrigin(req);
  if (!supabase) throw new HttpError(503, 'Collaboration storage is not configured.');
  const workspaceId = String(req.query.workspace || req.body?.workspaceId || process.env.COLLABORATION_WORKSPACE_ID || '');
  if (!workspaceId) throw new HttpError(503, 'Shared workspace setup is incomplete. Your administrator must configure the workspace.');
  const { data: membershipRows, error } = await supabase.rpc('collab_google_membership', {
    p_workspace: workspaceId,
    p_uid: user.uid,
    p_email: user.email,
  });
  if (error) throw new HttpError(503, 'Shared workspace access needs a database update. Ask your administrator to apply the Google sign-in migration.');
  const data = Array.isArray(membershipRows) ? membershipRows[0] : membershipRows;
  if (!data?.active) throw new HttpError(403, 'Your shared workspace access is disabled. Ask an administrator to restore access.');
  if ((write && data.role === 'viewer') || (admin && data.role !== 'admin')) throw new HttpError(403, 'Your workspace role does not permit this action.');
  return { ...user, workspaceId, role: data.role as 'admin' | 'editor' | 'viewer' };
}

export function safeFailure(error: unknown) { return error instanceof HttpError ? { status: error.status, message: error.message } : { status: 500, message: 'The request could not be saved. Your pending draft is retained.' }; }
