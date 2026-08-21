import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSheetsClient } from './_sheets.js';

/**
 * Vercel Serverless Function to fetch live data from a Google Sheet tab.
 * Replaces the old n8n liveSheet webhook.
 * 
 * Query params:
 * - sheetId: The Google Spreadsheet ID
 * - tab: The sheet tab name to read
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { sheetId, tab, schemaOnly } = req.query;

    if (!sheetId || typeof sheetId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid sheetId query parameter' });
    }
    if (!tab || typeof tab !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid tab query parameter' });
    }

    const sheets = await getSheetsClient();
    
    // Read the sheet data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${tab}'!A:AZ`, 
    });

    const rows = response.data.values || [];
    
    if (rows.length === 0) {
      return res.status(200).json([]);
    }

    // Find the header row dynamically
    let headerRowIndex = rows.findIndex((r: any[]) => r.some(c => typeof c === 'string' && (c.toUpperCase().includes('CONTROL #') || c.toUpperCase().includes('SAMPLE'))));
    if (headerRowIndex === -1) headerRowIndex = 0;

    // Convert array of arrays to array of objects (using the header row as keys)
    const headers = rows[headerRowIndex];

    if (schemaOnly === 'true') {
      return res.status(200).json({ headers });
    }

    const controlHeader = headers.find((h: any) => typeof h === 'string' && (h.toUpperCase().includes('CONTROL') || h.toUpperCase().includes('SAMPLE')));
    let lastControlNumber = '';

    const data = rows.slice(headerRowIndex + 1).map((row: any[], rowIndex) => {
      const obj: any = {};
      // Also add _rowIndex for update logic
      obj['_rowIndex'] = headerRowIndex + 2 + rowIndex;
      // Add the raw row array so we can access columns by index (A=0, B=1, etc.)
      obj['__rawRow'] = row;
      
      let currentRowControl = '';

      headers.forEach((header: string, i: number) => {
        // Note: this assumes headers are unique
        if (header) {
          const val = row[i] !== undefined ? row[i] : '';
          obj[header] = val;
          if (header === controlHeader) {
            currentRowControl = String(val).trim();
          }
        }
      });

      if (controlHeader) {
        if (currentRowControl === '') {
          // If the row has some text in other columns (i.e. it's part of a cluster)
          const hasData = row.some(cell => String(cell).trim() !== '');
          if (hasData && lastControlNumber) {
            obj[controlHeader] = lastControlNumber;
          }
        } else {
          lastControlNumber = currentRowControl;
        }
      }

      return obj;
    });

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error fetching sheet data:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch sheet data', 
      details: error.message 
    });
  }
}
