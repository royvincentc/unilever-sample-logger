import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSheetsClient } from './_sheets.js';
import { supabase } from './_supabase.js';

/**
 * Vercel Serverless Function to append or update a row in Google Sheets.
 * Replaces the old n8n submission webhook.
 * 
 * Body payload must include:
 * - spreadsheetId (string)
 * - sheetTab (string)
 * - controlNumber (string)
 * - isUpdate (boolean)
 * - (and all the column data mapped to the actual header names)
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    const { spreadsheetId, sheetTab, controlNumber, isUpdate, sampleType } = payload;

    if (!spreadsheetId || !sheetTab || !controlNumber) {
      return res.status(400).json({ error: 'Missing required metadata fields (spreadsheetId, sheetTab, controlNumber)' });
    }

    const sheets = await getSheetsClient();
    
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTab}'!1:5`, // fetch first 5 rows to ensure we find the header
    });

    const rows = headerResponse.data.values || [];
    if (rows.length === 0) {
      return res.status(404).json({ error: `Sheet tab '${sheetTab}' is empty.` });
    }

    let headerRowIndex = rows.findIndex((r: any[]) => r.some(c => typeof c === 'string' && (c.toUpperCase().includes('CONTROL #') || c.toUpperCase().includes('SAMPLE'))));
    if (headerRowIndex === -1) headerRowIndex = 0;

    const headers = rows[headerRowIndex] as string[];
    if (!headers || headers.length === 0) {
      return res.status(404).json({ error: `Sheet tab '${sheetTab}' has no headers.` });
    }

    // 2. Prepare the row array matching the header order
    const rowData = headers.map(header => {
      // If the payload has this header, use it, else empty string.
      // But don't overwrite if it's undefined/missing during an update.
      // For append, missing is empty string.
      return payload[header] !== undefined ? String(payload[header]) : null;
    });

    let success = false;
    let message = '';

    if (isUpdate) {
      let sheetRowNumber = -1;
      
      if (payload._rowIndex) {
        sheetRowNumber = parseInt(payload._rowIndex, 10);
      } else {
        // Find the row to update based on CONTROL #
        const colIndexControl = headers.findIndex(h => h.toUpperCase().includes('CONTROL'));
        
        if (colIndexControl === -1) {
          return res.status(400).json({ error: 'Could not find a CONTROL # column in the sheet.' });
        }

        // Read all control numbers to find the row index
        const idColumnRange = String.fromCharCode(65 + colIndexControl); // e.g. A, B, C...
        const idResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${sheetTab}'!${idColumnRange}:${idColumnRange}`,
        });

        const ids = idResponse.data.values?.map(r => r[0]) || [];
        
        // Control number might have "RM-" stripped in the app but present in the sheet, so compare loosely
        const targetClean = controlNumber.replace(/^RM-?/i, '').toLowerCase().trim();
        const rowIndex = ids.findIndex(id => {
          if (!id) return false;
          return String(id).replace(/^RM-?/i, '').toLowerCase().trim() === targetClean;
        });

        if (rowIndex !== -1) {
          sheetRowNumber = rowIndex + 1;
        }
      }

      if (sheetRowNumber !== -1) {
        
        // Before updating, read the existing row to not overwrite fields missing in the payload
        const existingRowResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${sheetTab}'!A${sheetRowNumber}:${String.fromCharCode(64 + headers.length)}${sheetRowNumber}`
        });
        
        const existingRowData = existingRowResponse.data.values?.[0] || [];
        
        const finalRowData = headers.map((header, i) => {
          if (payload[header] !== undefined) {
             return String(payload[header]);
          }
          return existingRowData[i] || ''; // preserve existing
        });

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${sheetTab}'!A${sheetRowNumber}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [finalRowData]
          }
        });
        
        success = true;
        message = 'Row updated';
      } 
      // If not found, fall through to insert-empty-row logic below
    }

    if (!success) {
      // Insert new row logic: Find the first empty row below the headers instead of using append (which skips formatted rows)
      const allDataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetTab}'!A:Z`,
      });
      
      const allRows = allDataResponse.data.values || [];
      let emptyRowIndex = -1;
      
      // Search starting right after the header row (headerRowIndex + 1 is 0-indexed)
      // If the spreadsheet has fewer rows than we need, we'll insert after the last row
      for (let i = headerRowIndex + 1; i < Math.max(allRows.length + 50, 5000); i++) {
        const row = allRows[i] || [];
        const isEmpty = row.every(cell => !cell || String(cell).trim() === '');
        if (isEmpty) {
          emptyRowIndex = i;
          break;
        }
      }

        if (emptyRowIndex !== -1) {
          const sheetRowNumber = emptyRowIndex + 1;
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${sheetTab}'!A${sheetRowNumber}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [rowData.map(v => v === null ? '' : v)]
            }
          });
          success = true;
          message = 'Inserted into first empty row';
        } else {
          // Fallback: Append new row if no empty rows exist
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `'${sheetTab}'!A1`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
              values: [rowData.map(v => v === null ? '' : v)]
            }
          });
          success = true;
          message = 'Row appended';
        }
    }

    // --- SUPABASE DUAL WRITE ---
    if (success && supabase) {
      try {
        const payloadData = { ...payload };
        delete payloadData.spreadsheetId;
        delete payloadData.sheetTab;
        delete payloadData.isUpdate;
        delete payloadData._rowIndex;
        delete payloadData.sampleType;
        
        // Find the sample name from the payload (it's whatever matches the 2nd header in the sheet)
        // Since we don't know the exact header name here, we'll try to find it.
        // It's usually the key that has "UNILEVER" or "SAMPLE" and is not the control number.
        // As a fallback, we grab the value of the 2nd key in the payload.
        const keys = Object.keys(payloadData);
        const sampleNameStr = keys.length > 1 ? String(payloadData[keys[1]]).trim() : 'Unknown';

        await supabase
          .from('samples')
          .upsert({
            control_number: controlNumber,
            sample_name: sampleNameStr,
            sample_type: sampleType || 'UNKNOWN',
            sheet_tab: sheetTab,
            status: payload['STATUS'] || payload['Status'] || payload.status || 'ON GOING',
            sheet_data: payloadData,
            updated_at: new Date().toISOString()
          }, { onConflict: 'control_number,sample_name' });
          
      } catch (sbError) {
        console.error('Supabase dual-write error:', sbError);
        // We don't fail the request if Supabase write fails, to ensure Sheets still works
      }
    }

    return res.status(200).json({ 
      success, 
      message,
      controlNumber,
    });

  } catch (error: any) {
    console.error('Submission error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to process submission', 
      details: error.message 
    });
  }
}
