import { randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  clearOAuthStateCookie,
  collaborationOAuthClient,
  cookieValue,
  HttpError,
  oauthStateCookie,
  safeFailure,
  sessionCookie,
  signSession,
  signedOAuthState,
  verifyOAuthState,
} from './_collaborationAuth.js';

function returnPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\r\n]/.test(value)) return '/kanban';
  return value;
}

function redirectWithMessage(path: string, message: string) {
  const target = new URL(path, 'https://workspace.invalid');
  target.searchParams.set('collaborationSignIn', message);
  return `${target.pathname}${target.search}${target.hash}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const action = String(req.query.action || '');
    if (action === 'login') {
      const { client } = collaborationOAuthClient();
      const state = randomBytes(32).toString('base64url');
      const returnTo = returnPath(req.query.returnTo);
      res.setHeader('Set-Cookie', oauthStateCookie(signedOAuthState(state, returnTo)));
      return res.redirect(client.generateAuthUrl({
        scope: ['openid', 'email', 'profile'],
        state,
        access_type: 'online',
        prompt: 'select_account',
      }));
    }

    if (action !== 'callback') return res.status(404).json({ error: 'Unknown sign-in action.' });

    const receivedState = typeof req.query.state === 'string' ? req.query.state : '';
    const state = verifyOAuthState(cookieValue(req, 'collab_oauth_state'), receivedState);
    res.setHeader('Set-Cookie', clearOAuthStateCookie());
    if (!state) throw new HttpError(400, 'Google sign-in expired. Please try again.');
    if (req.query.error) return res.redirect(redirectWithMessage(state.returnTo, 'cancelled'));
    if (typeof req.query.code !== 'string') throw new HttpError(400, 'Google sign-in did not return an authorization code.');

    const { client, clientId } = collaborationOAuthClient();
    const { tokens } = await client.getToken(req.query.code);
    if (!tokens.id_token) throw new HttpError(401, 'Google did not return a verified identity. Please try again.');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || profile.email_verified !== true) throw new HttpError(403, 'A verified Google account is required for shared boards.');

    const user = {
      uid: profile.sub,
      email: profile.email.trim().toLowerCase(),
      name: String(profile.name || profile.email).trim().slice(0, 100),
    };
    res.setHeader('Set-Cookie', [clearOAuthStateCookie(), sessionCookie(signSession(user))]);
    return res.redirect(state.returnTo);
  } catch (error) {
    const failure = safeFailure(error);
    if (failure.status >= 500) console.error('collaboration Google sign-in failure', error instanceof Error ? error.message : 'unknown');
    return res.status(failure.status).json({ error: failure.message });
  }
}
