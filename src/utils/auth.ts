import { AUTH_USERS, PIN_USERS, DEFAULT_SETTINGS } from '../data/constants';
import { db as firestore, auth } from './firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const AUTH_KEY = 'sample_logger_auth';
const SETTINGS_KEY = 'sample_logger_settings';

export function isAuthenticated(): boolean {
  const session = localStorage.getItem(AUTH_KEY);
  if (!session) return false;
  try {
    const parsed = JSON.parse(session);
    return parsed.authenticated === true;
  } catch {
    return false;
  }
}

export function getUserName(): string {
  const session = localStorage.getItem(AUTH_KEY);
  if (!session) return 'User';
  try {
    const parsed = JSON.parse(session);
    return parsed.userName || 'User';
  } catch {
    return 'User';
  }
}

export function loginWithPassword(username: string, password: string): boolean {
  const user = AUTH_USERS.find(u => u.username === username && u.password === password);
  if (user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ 
      authenticated: true, 
      method: 'password',
      userName: user.name 
    }));
    return true;
  }
  return false;
}

export function loginWithPin(pin: string): boolean {
  const user = PIN_USERS.find(u => u.pin === pin);
  if (user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ 
      authenticated: true, 
      method: 'pin',
      userName: user.name
    }));
    return true;
  }
  return false;
}

export async function signInWithGooglePopup(): Promise<{ success: boolean; firstName?: string; error?: string }> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    if (user) {
      let firstName = 'User';
      if (user.displayName) {
        firstName = user.displayName.split(' ')[0];
      } else if (user.email) {
        firstName = user.email.split('@')[0];
      }
      return { success: true, firstName };
    }
    return { success: false, error: 'No user data received' };
  } catch (e: any) {
    console.error('Google login error:', e);
    const errMsg = e.code ? `[${e.code}] ${e.message}` : e.message;
    return { success: false, error: errMsg || 'Google Auth Failed' };
  }
}

export function saveGoogleSession(firstName: string): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ 
    authenticated: true, 
    method: 'google',
    userName: firstName
  }));
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
  auth.signOut().catch(err => console.error('Sign out error:', err));
}

export function getSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure nested webhookUrls are merged, not overwritten
      return { 
        ...DEFAULT_SETTINGS, 
        ...parsed,
        webhookUrls: {
          ...DEFAULT_SETTINGS.webhookUrls,
          ...(parsed.webhookUrls || {})
        }
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Partial<typeof DEFAULT_SETTINGS>): void {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
}

// Cloud-synced sheet preference
const SHEET_PREF_DOC = 'app_config/sheet_preference';

export async function saveSheetPreference(spreadsheetId: string): Promise<void> {
  try {
    const docRef = doc(firestore, 'app_config', 'sheet_preference');
    await setDoc(docRef, { spreadsheetId, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('Failed to save sheet preference to cloud:', e);
  }
  // Also save locally for immediate access
  const current = getSettings();
  current.spreadsheetId = spreadsheetId;
  localStorage.setItem('sample_logger_settings', JSON.stringify(current));
}

export function listenToSheetPreference(callback: (spreadsheetId: string) => void) {
  const docRef = doc(firestore, 'app_config', 'sheet_preference');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data.spreadsheetId) {
        // Update local settings to match cloud
        const current = getSettings();
        if (current.spreadsheetId !== data.spreadsheetId) {
          current.spreadsheetId = data.spreadsheetId;
          localStorage.setItem('sample_logger_settings', JSON.stringify(current));
          callback(data.spreadsheetId);
        }
      }
    }
  });
}
