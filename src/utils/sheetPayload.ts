import type { SampleType } from '../types/index.js';

export interface SheetColumnOverride {
  header: string;
  source: string;
  value: string;
  match?: string;
}

export type SheetPayloadSettings = Record<string, Partial<Record<SampleType, SheetColumnOverride[]>>>;

export function sheetColumnLetter(position: number): string {
  let label = '';
  for (let column = position; column > 0; column = Math.floor((column - 1) / 26)) {
    label = String.fromCharCode(65 + (column - 1) % 26) + label;
  }
  return label;
}

const analysisFields = ['dateAnalyzed', 'analyzedBy', 'status', 'remarks'];

export const SHEET_PAYLOAD_FIELDS = {
  ENVI: ['dateSampled', 'timeSampled', 'swabbedBy', ...analysisFields, 'qty', 'unit',
    'controlNumber', 'sample', 'category', 'endorsedTo'],
  WATER: ['dateSampled', 'timeSampled', 'waterSource', 'sampledBy', ...analysisFields, 'qty', 'unit',
    'controlNumber', 'sample', 'endorsedTo'],
  RawMats: ['dateSampled', 'timeSampled', 'rfaf', 'batchNo', 'mixingBatchNo', 'cucNo', 'qty', 'unit',
    'type', 'sample', 'source', 'receivedBy', ...analysisFields, 'controlNumber',
    'dateReleased', 'releasedBy', 'endorsedTo', 'repeatedResults'],
  AIR: ['method', 'dateSampled', 'timeSampled', 'performedBy', 'status', 'remarks',
    'samplingPoint', 'controlNumber', 'sample'],
} satisfies Record<SampleType, string[]>;

export const SAMPLE_IDENTITY_HEADERS = ['SAMPLE', 'SAMPLE NAME', 'SAMPLE DESCRIPTION', 'WATER SOURCE', 'SAMPLING POINT', 'POINT'];

export function isIdentityColumn(header: string): boolean {
  const name = header.trim().toUpperCase();
  return name.includes('CONTROL') || SAMPLE_IDENTITY_HEADERS.includes(name);
}

export function validateSheetOverrides(overrides: unknown, headers: string[], sampleType: SampleType): string | undefined {
  if (!Array.isArray(overrides) || overrides.length > headers.length || !Object.hasOwn(SHEET_PAYLOAD_FIELDS, sampleType)) {
    return 'Invalid Google Sheets payload overrides.';
  }
  const used = new Set<string>();
  for (const rule of overrides) {
    if (!rule || typeof rule.header !== 'string' || !rule.header.trim() || typeof rule.value !== 'string' ||
        (rule.match !== undefined && typeof rule.match !== 'string') ||
        !['skip', 'fixed', ...SHEET_PAYLOAD_FIELDS[sampleType]].includes(rule.source)) {
      return 'Choose a sheet column and value for each override.';
    }
    if (headers.filter(header => header === rule.header).length !== 1) {
      return `Column "${rule.header}" must match one live sheet header.`;
    }
    if (isIdentityColumn(rule.header) || used.has(rule.header)) {
      return `Column "${rule.header}" is protected or already has an override.`;
    }
    used.add(rule.header);
  }
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
  'controlNumber':         ['control #', 'control number', 'control'],
  'status':                ['status'],
  'remarks':               ['remarks', 'remark', 'note', 'comment'],
  'dateAnalyzed':          ['date analyzed', 'date anal', 'analyzed date', 'analysis date'],
  'analyzedBy':            ['analyzed by', 'analyst'],
  'endorsedTo':            ['endorsed to', 'endorsed', 'endorse'],
  'dateReleased':          ['date released', 'released date', 'date'],
  'releasedBy':            ['released by', 'release by'],
  'repeatedResults':       ['repeated results', 'repeated result', 'repeated'],
  
  // ENVI specific
  'sample':                ['sample', 'sample name', 'sample description', 'material', 'product'],
  'category':              ['category'],
  'dateSampled':           ['date received/sampled', 'date received', 'received date', 'date swabbed', 'date sampled', 'swab date', 'date performed', 'date'],
  'timeSampled':           ['time swabbed', 'time sampled', 'swab time', 'time', 'time performed'],
  'swabbedBy':             ['swabbed by', 'swab by'],

  // WATER specific
  'waterSource':           ['water source', 'source', 'water supply', 'water type', 'location'],
  'sampledBy':             ['sampled by', 'sample by', 'collected by'],

  // RAW MATS specific
  'type':                  ['type'],
  'rfaf':                  ['rfaf'],
  'batchNo':               ['batch #', 'batch no', 'mixing batch', 'mix batch', 'batch', 'cuc', 'cuc #'],
  'mixingBatchNo':         ['batch #', 'mixing batch #', 'mixing batch', 'mix batch'],
  'cucNo':                 ['cuc #', 'cuc no', 'cuc', 'batch #'],
  'unit':                  ['unit', 'units'],
  'qty':                   ['qty', 'quantity'],
  'source':                ['source', 'supplier', 'vendor', 'origin'],
  'receivedBy':            ['received by', 'sampled by', 'collected by'],
  'indicativeResult':      ['indicative result', 'indicative'],
  'comments':              ['comments', 'comment'],
  'remarks2':              ['remarks2'],

  // AIR specific
  'method':                ['method'],
  'samplingPoint':         ['sampling point', 'point', 'location'],
  'performedBy':           ['performed by', 'sampled by', 'collected by'],
};

export function resolveColumn(logicalName: string, headers: string[], claimedKeys: Set<string> = new Set(), strict: boolean = false): string | null {
  // 1. Exact
  let match = headers.find(h => h === logicalName && !claimedKeys.has(h));
  if (match) return match;

  // 2. Case-insensitive & trimmed
  match = headers.find(h => h.trim().toUpperCase() === logicalName.trim().toUpperCase() && !claimedKeys.has(h));
  if (match) return match;

  // 3. Keyword exact match
  const keywords = Object.hasOwn(FIELD_KEYWORDS, logicalName) ? FIELD_KEYWORDS[logicalName] : [];
  for (const kw of keywords) {
    match = headers.find(h => h.trim().toLowerCase() === kw.toLowerCase() && !claimedKeys.has(h));
    if (match) return match;
  }

  if (strict) return null;

  // 4. Keyword substring match
  for (const kw of keywords) {
    match = headers.find(h => {
      if (claimedKeys.has(h)) return false;
      const ht = h.toLowerCase();
      const kwl = kw.toLowerCase();
      // Prevent 'sample' from matching 'sampled'
      if (kwl === 'sample' && ht.includes('sampled')) return false;
      // Prevent 'date' from matching 'update'
      if (kwl === 'date' && ht.includes('update')) return false;
      return ht.includes(kwl);
    });
    if (match) return match;
  }

  return null;
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

  const remapped: Record<string, unknown> = Object.create(null);

  const claimedLiveKeys = new Set<string>();
  const unmappedKeys: string[] = [];

  // Pass 1: Strict matches (exact name or exact keyword)
  for (const logicalKey of Object.keys(payload)) {
    const liveKey = resolveColumn(logicalKey, headers, claimedLiveKeys, true);
    if (liveKey) {
      remapped[liveKey] = payload[logicalKey];
      claimedLiveKeys.add(liveKey);
    } else {
      unmappedKeys.push(logicalKey);
    }
  }

  // Pass 2: Loose substring matches
  for (const logicalKey of unmappedKeys) {
    let liveKey = resolveColumn(logicalKey, headers, claimedLiveKeys, false);
    if (liveKey) {
      remapped[liveKey] = payload[logicalKey];
      claimedLiveKeys.add(liveKey);
    } else {
      // Fallback: if no match found at all, just map to the logical key itself
      // (This preserves keys that might be mapped later or handled specially)
      remapped[logicalKey] = payload[logicalKey];
    }
  }

  return remapped;
}

export function mapSampleColumns(
  payload: Record<string, unknown>,
  headers: string[],
  overrides: SheetColumnOverride[],
): Record<string, unknown> {
  const columns = remapPayloadToLiveColumns(payload, headers.filter(header => header.trim()));
  for (const { header, source, value, match } of overrides) {
    if (source === 'skip') delete columns[header];
    else if (source === 'fixed') columns[header] = value ? `'${value}` : '';
    else {
      const original = Object.hasOwn(payload, source) ? payload[source] : undefined;
      columns[header] = match && original === match ? (value ? `'${value}` : '') : original;
    }
  }
  return columns;
}

export function describeAutomaticColumns(sampleType: SampleType, headers: string[]): Record<string, string | undefined> {
  const sources = Object.fromEntries(SHEET_PAYLOAD_FIELDS[sampleType].map(field => [field, field]));
  return mapSampleColumns(sources, headers, []) as Record<string, string | undefined>;
}
