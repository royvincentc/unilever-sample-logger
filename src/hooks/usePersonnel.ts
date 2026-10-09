import { useEffect, useSyncExternalStore } from 'react';
import { getSettings } from '../utils/auth';
import { PERSONNEL, PERSONNEL_WITH_MARK, WATER_SAMPLER_OPTIONS } from '../data/personnelData';

export const PERSONNEL_SYNC_INTERVAL = 4 * 60 * 60 * 1000;
const DEFAULTS = {
  envi: [...PERSONNEL], enviAnalyst: [...PERSONNEL],
  waterSampler: [...WATER_SAMPLER_OPTIONS], waterAnalyst: [...PERSONNEL],
  air: [...PERSONNEL], rawReceiver: [...PERSONNEL_WITH_MARK], rawAnalyst: [...PERSONNEL],
};
export type PersonnelListKey = keyof typeof DEFAULTS;
export type PersonnelState = Record<PersonnelListKey, string[]>;
const keys = Object.keys(DEFAULTS) as PersonnelListKey[];
const listeners = new Set<() => void>();
let source = '';
let state = { lists: DEFAULTS as PersonnelState, syncedAt: 0, syncing: false, error: '', autoSync: true };
let inFlight: Promise<void> | null = null;
let inFlightSource = '';
let attemptedAt = 0;

function readStorage(key: string) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}
function validLists(value: unknown): value is PersonnelState {
  return !!value && typeof value === 'object' && keys.every(key => {
    const list = (value as PersonnelState)[key];
    return Array.isArray(list) && list.length > 0 && list.every(name => typeof name === 'string' && name.trim());
  });
}
function publish(patch: Partial<typeof state>) {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener());
}
function currentSource() {
  return `${getSettings().spreadsheetId}:${new Date().getFullYear()}`;
}
function ensureSource() {
  const next = currentSource();
  if (next === source) return;
  source = next;
  attemptedAt = 0;
  const cached = readStorage(`personnel_sheet:${source}`);
  publish({ lists: validLists(cached?.lists) ? cached.lists : DEFAULTS, syncedAt: validLists(cached?.lists) ? cached.syncedAt ?? 0 : 0, error: '' });
}

export async function syncPersonnel(): Promise<void> {
  if (inFlight) {
    const previousSource = inFlightSource;
    await inFlight;
    if (previousSource !== currentSource()) return syncPersonnel();
    return;
  }
  ensureSource();
  const requestSource = source;
  inFlightSource = requestSource;
  const [sheetId, year] = requestSource.split(':');
  attemptedAt = Date.now();
  publish({ syncing: true, error: '' });
  inFlight = (async () => {
    try {
      const response = await fetch(`/api/personnel?${new URLSearchParams({ sheetId, year })}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Personnel sync failed.');
      if (!validLists(data.lists)) throw new Error('Incomplete personnel dropdowns. Cached names were kept.');
      if (requestSource !== currentSource()) return;
      const syncedAt = Date.now();
      try { localStorage.setItem(`personnel_sheet:${requestSource}`, JSON.stringify({ lists: data.lists, syncedAt })); } catch {}
      publish({ lists: data.lists, syncedAt, error: '' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sync personnel.';
      if (requestSource === currentSource()) publish({ error: message });
      throw error;
    } finally {
      inFlight = null;
      publish({ syncing: false });
    }
  })();
  return inFlight;
}

// A shared scheduler checks the timestamp after browser suspension and reconnects.
export function startPersonnelSync() {
  const check = () => {
    ensureSource();
    if (state.autoSync && navigator.onLine && Date.now() - state.syncedAt >= PERSONNEL_SYNC_INTERVAL && Date.now() - attemptedAt >= 5 * 60 * 1000) {
      void syncPersonnel().catch(() => {});
    }
  };
  publish({ autoSync: readStorage('personnel_auto_sync') !== false });
  check();
  const timer = window.setInterval(check, 60 * 1000);
  window.addEventListener('online', check);
  window.addEventListener('focus', check);
  window.addEventListener('storage', check);
  window.addEventListener('personnel-settings-changed', check);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('online', check);
    window.removeEventListener('focus', check);
    window.removeEventListener('storage', check);
    window.removeEventListener('personnel-settings-changed', check);
  };
}

export function usePersonnel() {
  const snapshot = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => state);
  useEffect(ensureSource, []);
  const setAutoSync = (enabled: boolean) => {
    try { localStorage.setItem('personnel_auto_sync', JSON.stringify(enabled)); } catch {}
    publish({ autoSync: enabled });
    if (enabled && navigator.onLine && Date.now() - state.syncedAt >= PERSONNEL_SYNC_INTERVAL) void syncPersonnel().catch(() => {});
  };
  return { ...snapshot, syncPersonnel, setAutoSync };
}

export function getEnviPersonnel() { return state.lists.envi; }
export function getWaterSamplers() { return state.lists.waterSampler; }
export function getWaterAnalysts() { return state.lists.waterAnalyst; }
