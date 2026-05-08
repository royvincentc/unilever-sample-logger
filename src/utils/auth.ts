import { AUTH_CREDENTIALS, DEFAULT_SETTINGS } from '../data/constants';

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

export function loginWithPassword(username: string, password: string): boolean {
  if (
    username === AUTH_CREDENTIALS.username &&
    password === AUTH_CREDENTIALS.password
  ) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ authenticated: true, method: 'password' }));
    return true;
  }
  return false;
}

export function loginWithPin(pin: string): boolean {
  const settings = getSettings();
  if (pin === settings.pin) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ authenticated: true, method: 'pin' }));
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
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
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
