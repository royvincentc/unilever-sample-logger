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
      headers: { 'Content-Type': 'application/json' },
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
        result = JSON.parse(text);
      } catch (e) {
        console.warn('n8n returned non-JSON response:', text);
      }
    }

    return {
      success: true,
      controlNumber: result.controlNumber || result.control_number || 'N/A',
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
