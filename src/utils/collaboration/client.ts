import { auth } from '../firebase';
export class RequestError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status=status; } }
export async function request<T = any>(path: string, body?: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new RequestError(401, 'Sign in with Google to open the shared workspace.');
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${await user.getIdToken()}` }, body: body ? JSON.stringify(body) : undefined, cache:'no-store' });
  const data = await response.json();
  if (!response.ok) throw new RequestError(response.status, data.error || 'Request failed.');
  return data;
}
export const workspaceId = () => import.meta.env.VITE_COLLABORATION_WORKSPACE_ID || '';
export const endpoint = (suffix = '') => `/api/collaboration?workspace=${encodeURIComponent(workspaceId())}${suffix}`;
