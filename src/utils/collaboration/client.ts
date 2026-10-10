export class RequestError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status=status; } }
export async function request<T = any>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type':'application/json' }, body: body ? JSON.stringify(body) : undefined, cache:'no-store', credentials:'same-origin' });
  const data = await response.json();
  if (!response.ok) throw new RequestError(response.status, data.error || 'Request failed.');
  return data;
}
export function beginGoogleSignIn(returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`) {
  window.location.assign(`/api/collaboration-auth?action=login&returnTo=${encodeURIComponent(returnTo)}`);
}
export const workspaceId = () => import.meta.env.VITE_COLLABORATION_WORKSPACE_ID || '';
export const endpoint = (suffix = '') => `/api/collaboration?workspace=${encodeURIComponent(workspaceId())}${suffix}`;
