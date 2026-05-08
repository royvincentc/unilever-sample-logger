import { AUTH_USERS, PIN_USERS, DEFAULT_SETTINGS } from '../data/constants';

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

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
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
