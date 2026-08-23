import { useState, useEffect, useCallback } from 'react';
import type { SampleType, SheetSchema } from '../types';
import { fetchSheetSchema } from '../utils/api';
import { getSheetTabName } from '../utils/sheetMapping';
import { db as firestore } from '../utils/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const CACHE_TTL_MS = 1000 * 60 * 30; // 30-minute local cache before re-fetching

// Firestore collection that stores the latest schema per sample type.
// This means ALL devices share the same mapping automatically.
const SCHEMA_COLLECTION = 'app_config';

function schemaDocId(sampleType: SampleType) {
  return `schema_${sampleType.toLowerCase()}`;
}

/**
 * Fetches and caches the live column header schema for a given sheet tab.
 *
 * Behaviour:
 * - First read comes from Firestore (shared across all users).
 * - If the cached schema is >30 min old, a fresh fetch is triggered.
 * - A successful fetch is saved back to Firestore.
 * - Falls back gracefully to an empty schema if the endpoint is not configured.
 *
 * @param sampleType - 'ENVI' | 'WATER' | 'RawMats'
 * @param dateStr    - Used to determine the correct sheet tab name (e.g. 'MAY ENVI')
 * @param enabled    - Set to false to skip fetching (e.g. when offline)
 */
export function useSheetSchema(
  sampleType: SampleType | null,
  dateStr: string,
  enabled = true
): { schema: SheetSchema | null; loading: boolean; refresh: () => void } {
  const [schema, setSchema] = useState<SheetSchema | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAndSave = useCallback(async () => {
    if (!sampleType || !enabled) return;

    const sheetTab = getSheetTabName(sampleType);
    setLoading(true);

    try {
      // 1. Check Firestore cache first
      const docRef = doc(firestore, SCHEMA_COLLECTION, schemaDocId(sampleType));
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        const cached = snapshot.data() as SheetSchema;
        const age = Date.now() - new Date(cached.fetchedAt).getTime();
        if (age < CACHE_TTL_MS && cached.sheetTab === sheetTab && cached.headers?.length > 0) {
          setSchema(cached);
          setLoading(false);
          return;
        }
      }

      // 2. Cache miss or stale — fetch live from n8n
      const headers = await fetchSheetSchema(sheetTab);

      if (headers.length > 0) {
        const newSchema: SheetSchema = {
          sampleType,
          sheetTab,
          headers,
          fetchedAt: new Date().toISOString(),
        };
        setSchema(newSchema);

        // 3. Persist to Firestore so all devices get the update
        try {
          await setDoc(docRef, newSchema);
        } catch (e) {
          console.warn('Could not save schema to Firestore:', e);
        }
      } else if (snapshot.exists()) {
        // Fetch returned empty — use stale cache as fallback
        setSchema(snapshot.data() as SheetSchema);
      }
    } catch (e) {
      console.error('useSheetSchema error:', e);
    } finally {
      setLoading(false);
    }
  }, [sampleType, dateStr, enabled]);

  useEffect(() => {
    fetchAndSave();
  }, [fetchAndSave]);

  return { schema, loading, refresh: fetchAndSave };
}

/**
 * Given the live schema headers and a logical field name,
 * returns the current sheet column name that best matches it.
 *
 * Resolution order:
 *   1. Exact match
 *   2. Case-insensitive match
 *   3. Keyword substring match (from FIELD_KEYWORDS table)
 *   4. Fallback: the logical name itself
 */
const FIELD_KEYWORDS: Record<string, string[]> = {
  // Shared / General
  'controlNumber':         ['control'],
  'status':                ['status'],
  'remarks':               ['remark', 'note', 'comment'],
  'dateAnalyzed':          ['date anal', 'analyzed date', 'analysis date'],
  'analyzedBy':            ['analyzed by', 'analyst'],
  'endorsedTo':            ['endorsed', 'endorse'],
  
  // ENVI specific
  'sample':                ['sample', 'material', 'product'],
  'category':              ['category'],
  'dateSampled':           ['date received', 'received date', 'date swabbed', 'date sampled', 'swab date', 'date performed'],
  'timeSampled':           ['time swabbed', 'time sampled', 'swab time', 'time', 'time performed'],
  'swabbedBy':             ['swabbed by', 'swab by'],

  // WATER specific
  'waterSource':           ['water source', 'source', 'water supply', 'water type', 'location'],
  'sampledBy':             ['sampled by', 'sample by', 'collected by'],

  // RAW MATS specific
  'type':                  ['type'],
  'rfaf':                  ['rfaf'],
  'batchNo':               ['batch #', 'batch no', 'mixing batch', 'mix batch', 'batch', 'cuc', 'cuc #'],
  'source':                ['source', 'supplier', 'vendor', 'origin'],
  'receivedBy':            ['received by', 'sampled by', 'collected by'],

  // AIR specific
  'method':                ['method'],
  'samplingPoint':         ['sampling point', 'point', 'location'],
  'performedBy':           ['performed by', 'sampled by', 'collected by'],
};

export function resolveColumn(logicalName: string, headers: string[]): string {
  // 1. Exact
  const exact = headers.find(h => h === logicalName);
  if (exact) return exact;

  // 2. Case-insensitive
  const ci = headers.find(h => h.toUpperCase() === logicalName.toUpperCase());
  if (ci) return ci;

  // 3. Keyword
  const keywords = FIELD_KEYWORDS[logicalName] ?? [];
  for (const kw of keywords) {
    const kMatch = headers.find(h => h.toLowerCase().includes(kw.toLowerCase()));
    if (kMatch) return kMatch;
  }

  // 4. Fallback
  return logicalName;
}

/**
 * Given live headers and a payload keyed by logical names,
 * returns a new payload object keyed by the LIVE (current) column names.
 * Unknown logical names are passed through unchanged.
 * Any header that exists in the schema but is NOT in the payload is set to ''.
 */
export function remapPayloadToLiveColumns(
  payload: Record<string, unknown>,
  headers: string[]
): Record<string, unknown> {
  if (!headers || headers.length === 0) return payload;

  const remapped: Record<string, unknown> = {};

  // Initialise all known sheet columns to empty string
  headers.forEach(h => { remapped[h] = ''; });

  // Fill in our values using live column names
  for (const [logicalKey, value] of Object.entries(payload)) {
    const liveKey = resolveColumn(logicalKey, headers);
    remapped[liveKey] = value;
  }

  return remapped;
}
