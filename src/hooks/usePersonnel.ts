/**
 * usePersonnel — persisted personnel list manager.
 *
 * Three lists are stored independently in localStorage:
 *   ENVI_PERSONNEL      → "Swabbed By / Analyzed By" for ENVI & RawMats
 *   WATER_SAMPLERS      → "Sampled By" for WATER (includes PF4 sub-names)
 *   WATER_ANALYSTS      → "Analyzed By" for WATER (same as ENVI_PERSONNEL by default)
 *
 * Any component can call getPersonnel() / getWaterSamplers() to get the
 * current list without subscribing to React state — useful for static
 * data files. The hook version is used in the Settings editor.
 */

import { useState, useCallback, useEffect } from 'react';
import { db as firestore } from '../utils/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const STORAGE_KEYS = {
  envi:         'personnel_envi',
  waterSampler: 'personnel_water_sampler',
  waterAnalyst: 'personnel_water_analyst',
} as const;

// ── Default values (mirrors personnelData.ts) ────────────────────────────────

const DEFAULT_ENVI_PERSONNEL = [
  'CODINERA', 'SUMALPONG', 'WAGAS', 'ALBESA', 'CAWIT', 'EDISAN',
  'BARANGAN', 'CANOY', 'GOLORAN', 'VILLAVER', 'PF4', 'JUEN-PATA',
  'CODINERA / VILLAVER', 'CODINERA / CANOY',
];

const DEFAULT_WATER_SAMPLERS = [
  'WAGAS', 'CODINERA', 'PF4',
  'PF4: R. Olasiman', 'PF4: Darren Teofilo', 'PF4: Melvin V.',
  'PF4: R. Alcalde', 'PF4: Branne Abatayo', 'PF4: Ritche',
  'PF4: A. Delgado', 'PF4: R. Gabumpa', 'PF4: JP Lanurias', 'PF4: M. Valle',
];

const DEFAULT_WATER_ANALYSTS = [...DEFAULT_ENVI_PERSONNEL];

// ── Storage helpers ───────────────────────────────────────────────────────────

function loadLocal(key: string, fallback: string[]): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [...fallback];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...fallback];
  } catch {
    return [...fallback];
  }
}

function saveLocal(key: string, list: string[]) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch {}
}

const FIREBASE_DOC = 'app_config/personnel_lists';

async function saveFirebase(lists: PersonnelState) {
  try {
    const docRef = doc(firestore, 'app_config', 'personnel_lists');
    await setDoc(docRef, lists, { merge: true });
  } catch (e) {
    console.warn('Could not sync personnel to Firestore:', e);
  }
}

// ── Public getters (for non-React contexts like personnelData.ts) ─────────────

export function getEnviPersonnel():    string[] { return loadLocal(STORAGE_KEYS.envi,         DEFAULT_ENVI_PERSONNEL); }
export function getWaterSamplers():    string[] { return loadLocal(STORAGE_KEYS.waterSampler,  DEFAULT_WATER_SAMPLERS); }
export function getWaterAnalysts():    string[] { return loadLocal(STORAGE_KEYS.waterAnalyst,  DEFAULT_WATER_ANALYSTS); }

// ── React hook ────────────────────────────────────────────────────────────────

export type PersonnelListKey = 'envi' | 'waterSampler' | 'waterAnalyst';

export interface PersonnelState {
  envi:         string[];
  waterSampler: string[];
  waterAnalyst: string[];
}

export function usePersonnel() {
  const [lists, setLists] = useState<PersonnelState>(() => ({
    envi:         loadLocal(STORAGE_KEYS.envi,         DEFAULT_ENVI_PERSONNEL),
    waterSampler: loadLocal(STORAGE_KEYS.waterSampler, DEFAULT_WATER_SAMPLERS),
    waterAnalyst: loadLocal(STORAGE_KEYS.waterAnalyst, DEFAULT_WATER_ANALYSTS),
  }));

  useEffect(() => {
    const docRef = doc(firestore, 'app_config', 'personnel_lists');
    
    // First read
    getDoc(docRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as PersonnelState;
        if (data.envi && data.waterSampler && data.waterAnalyst) {
          setLists(data);
          saveLocal(STORAGE_KEYS.envi, data.envi);
          saveLocal(STORAGE_KEYS.waterSampler, data.waterSampler);
          saveLocal(STORAGE_KEYS.waterAnalyst, data.waterAnalyst);
        }
      }
    }).catch(console.warn);

    // Subscribe to changes
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as PersonnelState;
        if (data.envi && data.waterSampler && data.waterAnalyst) {
          setLists(data);
          saveLocal(STORAGE_KEYS.envi, data.envi);
          saveLocal(STORAGE_KEYS.waterSampler, data.waterSampler);
          saveLocal(STORAGE_KEYS.waterAnalyst, data.waterAnalyst);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const updateList = useCallback((key: PersonnelListKey, updater: (prev: string[]) => string[]) => {
    setLists(prev => {
      const next = updater(prev[key]);
      saveLocal(STORAGE_KEYS[key], next);
      
      const newLists = { ...prev, [key]: next };
      saveFirebase(newLists);
      
      return newLists;
    });
  }, []);

  const addName = useCallback((key: PersonnelListKey, name: string) => {
    const trimmed = name.trim().toUpperCase();
    if (!trimmed) return;
    updateList(key, prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
  }, [updateList]);

  const addNameRaw = useCallback((key: PersonnelListKey, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateList(key, prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
  }, [updateList]);

  const removeName = useCallback((key: PersonnelListKey, name: string) => {
    updateList(key, prev => prev.filter(n => n !== name));
  }, [updateList]);

  const moveUp = useCallback((key: PersonnelListKey, index: number) => {
    if (index === 0) return;
    updateList(key, prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, [updateList]);

  const moveDown = useCallback((key: PersonnelListKey, index: number) => {
    updateList(key, prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, [updateList]);

  const resetToDefault = useCallback((key: PersonnelListKey) => {
    const defaults: Record<PersonnelListKey, string[]> = {
      envi:         DEFAULT_ENVI_PERSONNEL,
      waterSampler: DEFAULT_WATER_SAMPLERS,
      waterAnalyst: DEFAULT_WATER_ANALYSTS,
    };
    
    setLists(prev => {
      const newLists = { ...prev, [key]: [...defaults[key]] };
      saveLocal(STORAGE_KEYS[key], newLists[key]);
      saveFirebase(newLists);
      return newLists;
    });
  }, []);

  return { lists, addName, addNameRaw, removeName, moveUp, moveDown, resetToDefault };
}
