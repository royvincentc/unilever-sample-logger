import { getSettings } from './auth';

interface WebhookResponse {
  success: boolean;
  controlNumber?: string;
  error?: string;
}

/**
 * Send sample data to Vercel Serverless Function (replaces n8n).
 */
export async function sendToWebhook(
  endpoint: 'envi' | 'water' | 'rawmats' | 'air',
  data: Record<string, unknown>
): Promise<WebhookResponse> {
  const settings = getSettings();

  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        spreadsheetId: settings.spreadsheetId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    return {
      success: result.success,
      controlNumber: result.controlNumber || 'N/A',
      error: result.error || result.message
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Updates an existing row in the live Google Sheet.
 * This directly calls the /api/submit endpoint with isUpdate = true.
 */
export async function updateSheetRow(
  sheetTab: string,
  controlNumber: string,
  updates: Record<string, unknown>
): Promise<WebhookResponse> {
  const settings = getSettings();
  if (!settings.spreadsheetId) {
    return { success: false, error: 'Spreadsheet ID not configured in settings.' };
  }

  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...updates,
        spreadsheetId: settings.spreadsheetId,
        sheetTab,
        controlNumber,
        isUpdate: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      success: result.success,
      controlNumber: result.controlNumber || controlNumber,
      error: result.error || result.message
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Single sheet fetch that returns BOTH:
 *   - incompleteControlNumber
 *   - highestControlNumber
 */
export async function analyseSheetForSubmission(
  sampleType: 'WATER' | 'RawMats' | 'AIR',
  sheetTab: string
): Promise<{ incompleteControlNumber: string | null; highestControlNumber: string | null }> {
  const empty = { incompleteControlNumber: null, highestControlNumber: null };
  const settings = getSettings();

  try {
    const response = await fetch(`/api/sheet-data?sheetId=${settings.spreadsheetId}&tab=${encodeURIComponent(sheetTab)}`);
    if (!response.ok) return empty;

    const dataRows = await response.json();
    if (!Array.isArray(dataRows) || dataRows.length === 0) return empty;

    const getControl = (row: any): string => {
      const raw = String(row['CONTROL #'] || '').trim();
      return sampleType === 'RawMats' ? raw.replace(/^RM-?/i, '') : raw;
    };

    const isEmpty = (v: any): boolean => {
      const s = String(v ?? '').trim();
      return s === '' || s === '-' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null';
    };

    const incompleteList: string[] = [];
    let lastNum = 0;
    let foundYear = '';

    for (const row of dataRows) {
      const ctrl = getControl(row);
      if (!ctrl) continue;

      const match = ctrl.match(/(?:[EW]?\d{2}-)?(\d{2})-(\d+)/i) || ctrl.match(/^(\d{2})-(\d+)$/);
      if (match) {
        foundYear = match[1];
        const num = parseInt(match[2], 10);
        if (num > lastNum) lastNum = num;
      }

      if (sampleType === 'WATER') {
        if (isEmpty(row['WATER SOURCE'])) incompleteList.push(ctrl);
      } else {
        if (isEmpty(row['TYPE']) || isEmpty(row['SAMPLE'])) incompleteList.push(ctrl);
      }
    }

    incompleteList.sort((a, b) =>
      parseInt(b.split('-').pop() || '0', 10) - parseInt(a.split('-').pop() || '0', 10)
    );

    const highestControlNumber = lastNum > 0
      ? `${foundYear || new Date().getFullYear().toString().slice(-2)}-${String(lastNum).padStart(3, '0')}`
      : null;

    return {
      incompleteControlNumber: incompleteList[0] ?? null,
      highestControlNumber,
    };
  } catch (e) {
    console.warn('analyseSheetForSubmission failed:', e);
    return empty;
  }
}

/**
 * Kept for UI compatibility in Settings, but webhooks are deprecated.
 */
export async function testWebhookConnection(url: string): Promise<boolean> {
  return true;
}

import { getHistory, updateHistory } from './db';

/**
 * Fetch live data from Google Sheets to sync "RELEASED" statuses back to local DB.
 * Returns an array of updated entry IDs.
 */
export async function fetchHistoryFromSheet(): Promise<string[]> {
  const settings = getSettings();
  if (!settings.spreadsheetId) return [];

  try {
    // 1. Get local history that needs syncing (ongoing, OR missing sheetAnalyst)
    const localHistory = await getHistory();
    const needsSync = localHistory.filter(e => 
      (e.status !== 'RELEASED' && e.status !== 'COMPLETED') || !e.sheetAnalyst
    );
    if (needsSync.length === 0) return [];

    const updatedIds: string[] = [];
    const tabGroups = new Map<string, typeof needsSync>();
    
    for (const item of needsSync) {
      const date = item.dateSampled ? new Date(item.dateSampled) : new Date();
      const yearStr = date.getFullYear().toString();
      
      let tabName = '';
      if (item.sampleType === 'ENVI') tabName = `SWAB ${yearStr}`;
      if (item.sampleType === 'WATER') tabName = `WATER ${yearStr}`;
      if (item.sampleType === 'RawMats') tabName = `RM,FG,SFG ${yearStr}`;
      if (item.sampleType === 'AIR') tabName = `AIR ${yearStr}`;
      
      if (!tabGroups.has(tabName)) tabGroups.set(tabName, []);
      tabGroups.get(tabName)!.push(item);
    }

    // 2. Fetch live sheet data for each tab
    for (const [tabName, itemsInTab] of tabGroups.entries()) {
      try {
        const dataRows = await fetchLiveSheetData(tabName);
        
        for (const local of itemsInTab) {
          // Find row matching control number
          const matchRow = dataRows.find(r => {
            const rowCtrl = String(r['CONTROL #'] || '').trim();
            const locCtrl = local.controlNumber;
            
            // Strip any leading alphabetical characters and hyphens (e.g. W, E, RM, RM-) to strictly compare the digits
            const cleanRow = rowCtrl.replace(/^[A-Z-]+/i, '');
            const cleanLoc = locCtrl.replace(/^[A-Z-]+/i, '');
            
            return cleanRow === cleanLoc;
          });

          if (matchRow) {
            const dateReleased = String(matchRow['DATE RELEASED'] || matchRow['DATE & TIME RELEASED'] || '').trim();
            const statusCol = String(matchRow['STATUS'] || '').trim().toUpperCase();
            const analystCol = String(matchRow['ANALYST'] || matchRow['ANALYZED BY'] || matchRow['ANALYSTS'] || '').trim();

            const isReleased = (dateReleased !== '' && dateReleased !== '-') || 
                               statusCol === 'COMPLETED' || 
                               statusCol === 'RELEASED';

            let changed = false;
            let updatedData = { ...local };

            if (isReleased && local.status !== 'RELEASED' && local.status !== 'COMPLETED') {
              updatedData.status = 'RELEASED';
              changed = true;
            }

            if (analystCol && analystCol !== '-' && local.sheetAnalyst !== analystCol) {
              updatedData.sheetAnalyst = analystCol;
              changed = true;
            }

            if (changed) {
              await updateHistory(updatedData);
              updatedIds.push(local.id);
            }
          }
        }
      } catch (e) {
        console.warn(`Failed to sync tab ${tabName}:`, e);
      }
    }
    return updatedIds;
  } catch (error) {
    console.error('History sync failed:', error);
    return [];
  }
}

/**
 * Fetch live data from Google Sheets via Vercel Function.
 */
export async function fetchLiveSheetData(sheetTab: string): Promise<any[]> {
  const settings = getSettings();
  try {
    const response = await fetch(`/api/sheet-data?sheetId=${settings.spreadsheetId}&tab=${encodeURIComponent(sheetTab)}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Live sheet fetch failed:', error);
    throw error;
  }
}

/**
 * Fetch the live header row (schema) for a given sheet tab via Vercel Function.
 */
export async function fetchSheetSchema(sheetTab: string): Promise<string[]> {
  const settings = getSettings();
  try {
    const response = await fetch(`/api/sheet-data?sheetId=${settings.spreadsheetId}&tab=${encodeURIComponent(sheetTab)}&schemaOnly=true`);
    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data?.headers) ? data.headers : [];
  } catch (error) {
    console.error('fetchSheetSchema failed:', error);
    return [];
  }
}
