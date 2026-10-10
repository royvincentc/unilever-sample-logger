// The Google client and the database JWT issuer are pinned to this project.
export const CLIENT_FIREBASE_PROJECT = 'unilever-qc';
export function firebaseIdentityConfig(env: Record<string, string | undefined>) {
  const projectId = env.FIREBASE_PROJECT_ID || CLIENT_FIREBASE_PROJECT;
  if (projectId !== CLIENT_FIREBASE_PROJECT) throw new Error('The server Firebase project must match the app.');
  const dedicated = env.FIREBASE_ADMIN_CREDENTIALS;
  const raw = dedicated || env.GCP_CREDENTIALS_JSON || env.GOOGLE_CREDENTIALS;
  if (!raw) throw new Error('Firebase server credentials are missing.');
  let credentials: any;
  try { credentials = JSON.parse(raw); } catch { throw new Error('Firebase server credentials are invalid.'); }
  if (!credentials?.client_email || !credentials?.private_key || !credentials?.project_id) throw new Error('Firebase server credentials are incomplete.');
  if (!dedicated && credentials.project_id !== projectId) throw new Error('The existing Google credential belongs to another project. Add Firebase Admin credentials for this app.');
  return { projectId, credentials };
}
