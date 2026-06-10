import { getSettings } from './auth';

interface WebhookResponse {
  success: boolean;
  controlNumber?: string;
  error?: string;
}

/**
 * Send sample data to n8n webhook.
 * Falls back gracefully when no webhook URL is configured (mock mode).
 */
export async function sendToWebhook(
  endpoint: 'envi' | 'water' | 'rawmats',
  data: Record<string, unknown>
): Promise<WebhookResponse> {
  const settings = getSettings();
  const url = settings.webhookUrls[endpoint];

  // Mock mode: no webhook URL configured
  if (!url) {
    // Simulate a short delay to show loading state
    await new Promise(r => setTimeout(r, 800));
    return {
      success: true,
      controlNumber: data.controlNumber as string || 'MOCK-001',
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_N8N_API_KEY || ''
      },
      body: JSON.stringify({
        ...data,
        spreadsheetId: settings.spreadsheetId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Safely parse JSON to handle empty or plain-text responses from n8n
    const text = await response.text();
    let result: any = {};
    if (text) {
      try {
        const parsed = JSON.parse(text);
        // Handle n8n sometimes returning an array of items, or a single item with a 'json' property
        if (Array.isArray(parsed) && parsed.length > 0) {
          result = parsed[0].json || parsed[0];
        } else if (parsed.json) {
          result = parsed.json;
        } else {
          result = parsed;
        }
      } catch (e) {
        console.warn('n8n returned non-JSON response:', text);
      }
    }

    // A response is successful if n8n says so, or if it's a non-error object from a successful HTTP call
    const success = result.success !== undefined ? result.success : true;

    return {
      success,
      controlNumber: result.controlNumber || result.control_number || result['CONTROL #'] || 'N/A',
      error: result.error || result.message || (success ? undefined : 'Webhook failed without specific error')
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test webhook connectivity.
 * Tries POST first, falls back to no-cors mode for basic reachability check.
 */
export async function testWebhookConnection(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    // Try a normal POST first
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_N8N_API_KEY || ''
      },
      body: JSON.stringify({ test: true }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    clearTimeout(timeout);

    // If CORS blocks it, try a no-cors ping (we can't read the response,
    // but if it doesn't throw, the server is at least reachable)
    try {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 5000);
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: '{"test":true}',
        signal: controller2.signal,
      });
      clearTimeout(timeout2);
      // no-cors fetch succeeded — server is reachable (CORS just blocks reading response)
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Fetch the last X entries from Google Sheets via n8n sync endpoint.
 */
export async function fetchHistoryFromSheet(): Promise<any[]> {
  const settings = getSettings();
  const url = settings.webhookUrls.sync || 'https://n8n-royvincentc.onrender.com/webhook/sync-history';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_N8N_API_KEY || ''
      },
      body: JSON.stringify({ 
        spreadsheetId: settings.spreadsheetId,
        limit: 50 
      }),
    });

    if (!response.ok) return [];
    
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Sync failed:', error);
    return [];
  }
}

/**
 * Fetch live data from Google Sheets via n8n webhook.
 */
export async function fetchLiveSheetData(sheetTab: string): Promise<any[]> {
  const settings = getSettings();
  // Provide a default URL or rely on user settings
  const url = settings.webhookUrls.liveSheet || 'https://n8n-royvincentc.onrender.com/webhook/get-sheet-data';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_N8N_API_KEY || ''
      },
      body: JSON.stringify({ 
        spreadsheetId: settings.spreadsheetId,
        sheetTab
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    let data: any = [];
    if (text) {
      try {
        const parsed = JSON.parse(text);
        // n8n often returns { value: [...], Count: X } for multiple items
        if (parsed && Array.isArray(parsed.value)) {
          data = parsed.value;
        } else if (Array.isArray(parsed)) {
          data = parsed;
        } else {
          data = [parsed];
        }
      } catch (e) {
        console.warn('n8n returned non-JSON response for live sheet:', text);
      }
    }

    if (!Array.isArray(data) || data.length === 0) return [];

    // Find the row that contains the actual headers (e.g. 'CONTROL #')
    const headerRowIndex = data.findIndex(row => 
      Object.values(row).some(v => 
        typeof v === 'string' && (v.toUpperCase().includes('CONTROL #') || v.toUpperCase().includes('DATE') || v.toUpperCase().includes('STATUS'))
      )
    );

    if (headerRowIndex !== -1) {
      const headerRow = data[headerRowIndex];
      const headerMap: Record<string, string> = {};
      
      for (const [key, value] of Object.entries(headerRow)) {
        headerMap[key] = typeof value === 'string' ? value.trim() : key;
      }
      
      // Map the rest of the rows using the real headers (data after the header row)
      return data.slice(headerRowIndex + 1).map(row => {
        const newRow: any = {};
        for (const [key, value] of Object.entries(row)) {
          const properKey = headerMap[key] || key;
          newRow[properKey] = value;
        }
        return newRow;
      });
    }

    // If headers are already correct, or no header row found
    return data;
  } catch (error) {
    console.error('Live sheet fetch failed:', error);
    throw error;
  }
}

/**
 * Fetch the live header row (schema) for a given sheet tab via n8n.
 * Returns an array of column header strings in sheet order, e.g.
 * ['CONTROL #', 'SAMPLE', 'QTY', 'UNIT', …]
 *
 * Uses the schema webhook URL if configured, otherwise falls back to
 * the liveSheet webhook URL (both return the same raw row data).
 */
export async function fetchSheetSchema(
  sheetTab: string
): Promise<string[]> {
  const settings = getSettings();
  const url = settings.webhookUrls.schema || settings.webhookUrls.liveSheet || '';

  if (!url) {
    console.warn('No schema webhook URL configured. Returning empty schema.');
    return [];
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_N8N_API_KEY || ''
      },
      body: JSON.stringify({
        spreadsheetId: settings.spreadsheetId,
        sheetTab,
        schemaOnly: true,
      }),
    });

    if (!response.ok) return [];

    const text = await response.text();
    if (!text) return [];

    let rows: any[] = [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed?.value)) rows = parsed.value;
      else if (Array.isArray(parsed)) rows = parsed;
      else rows = [parsed];
    } catch {
      return [];
    }

    // Find the header row — the row that contains 'CONTROL' somewhere
    for (const row of rows) {
      const vals = Object.values(row);
      const isHeaderRow = vals.some(
        v => typeof v === 'string' && v.toUpperCase().includes('CONTROL')
      );
      if (isHeaderRow) {
        return vals
          .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
          .map(v => (v as string).trim());
      }
    }

    return [];
  } catch (error) {
    console.error('fetchSheetSchema failed:', error);
    return [];
  }
}
