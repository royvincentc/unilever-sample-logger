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
    console.log('--- POST /api/submit ---');
    console.log('Payload is bulk?', !!payload.bulk);
    
    const isBulk = payload.bulk === true && Array.isArray(payload.items);
    const basePayload = isBulk ? payload.items[0] : payload;
    
    const { spreadsheetId, sheetTab, controlNumber, isUpdate, sampleType } = basePayload;

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

    // 2. Prepare the row arrays matching the header order
    const items = isBulk ? payload.items : [payload];
    const rowDataArray = items.map(item => {
      return headers.map(header => item[header] !== undefined ? String(item[header]) : null);
    });
    const rowData = rowDataArray[0]; // for backward compatibility in single mode

    let success = false;
    let message = '';
    let finalRowData: string[] | null = null;
    let sheetRowNumber = -1;

    // We will always try to find an existing row to update first, even if isUpdate is false.
    // This allows users to pre-fill Sample Names in the sheet, and the app will fill in the rest.
    
    // 1. Identify Target Control Number and Target Sample Name
    const targetCleanCtrl = controlNumber.replace(/^RM-?/i, '').toLowerCase().trim();
    const targetCleanSample = String(
      payload['SAMPLE NAME'] || 
      payload['SAMPLE'] || 
      payload['WATER SOURCE'] || 
      payload['SAMPLING POINT'] || 
      payload['POINT'] || 
      ''
    ).toLowerCase().trim();

function getColumnLetter(colNumber: number): string {
  let temp, letter = '';
  let col = colNumber;
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = Math.floor((col - temp - 1) / 26);
  }
  return letter || 'Z';
}

    // 2. Fetch all rows to scan for a match, or to find the first empty row
    const allRowsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTab}'!A:Z`,
    });
    const allRows = allRowsResponse.data.values || [];

    if (payload._rowIndex && isUpdate) {
      sheetRowNumber = parseInt(payload._rowIndex, 10);
    } else {
      let lastControlNumber = '';
      
      // Determine which column index holds the Sample Name (usually 1, 2, 3, 4, or 5)
      let sampleNameColIndex = headers.findIndex(h => {
        const u = h.toUpperCase();
        return u === 'SAMPLE' || u === 'SAMPLE NAME' || u === 'WATER SOURCE' || u === 'SAMPLING POINT' || u === 'POINT';
      });
      if (sampleNameColIndex === -1) sampleNameColIndex = 1; // Default to B
      
      let controlColIndex = headers.findIndex(h => h.toUpperCase().includes('CONTROL #') || h.toUpperCase().includes('CONTROL'));
      if (controlColIndex === -1) controlColIndex = 0; // Default to A

      for (let i = headerRowIndex + 1; i < allRows.length; i++) {
        const r = allRows[i] || [];
        
        // Track last control number for merged cells
        const rawCtrl = r[controlColIndex] ? String(r[controlColIndex]).trim() : '';
        if (rawCtrl) {
          lastControlNumber = rawCtrl.replace(/^RM-?/i, '').toLowerCase().trim();
        }
        
        const rowSample = r[sampleNameColIndex] ? String(r[sampleNameColIndex]).toLowerCase().trim() : '';
        
        if (targetCleanSample) {
           if (lastControlNumber === targetCleanCtrl && rowSample === targetCleanSample) {
              sheetRowNumber = i + 1;
              break;
           }
        } else {
           if (lastControlNumber === targetCleanCtrl && !rowSample) {
              sheetRowNumber = i + 1;
              break;
           }
        }
      }
    }

    if (sheetRowNumber !== -1) {
      // We found the row, UPDATE IT.
      const endColLetter = getColumnLetter(headers.length);
      const existingRowResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetTab}'!A${sheetRowNumber}:${endColLetter}${sheetRowNumber}`
      });
      
      const existingRowData = existingRowResponse.data.values?.[0] || [];
      
      finalRowData = headers.map((header, i) => {
        if (payload[header] !== undefined) {
           return String(payload[header]);
        }
        return existingRowData[i] || ''; // preserve existing
      });

      const valuesToWrite = [finalRowData];
      if (isBulk && rowDataArray.length > 1) {
        for (let j = 1; j < rowDataArray.length; j++) {
          valuesToWrite.push(rowDataArray[j].map(v => v === null ? '' : v));
        }
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetTab}'!A${sheetRowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: valuesToWrite
        }
      });
      
      success = true;
      message = isBulk ? 'Rows updated/inserted successfully' : 'Row updated successfully';
    } else {
      // Insert new row logic: Find the first empty row below the headers
      // A row is considered empty if its Control Number AND Sample Name are blank.
      let emptyRowIndex = -1;
      
      let sampleNameColIndex = headers.findIndex(h => {
        const u = h.toUpperCase();
        return u === 'SAMPLE' || u === 'SAMPLE NAME' || u === 'WATER SOURCE' || u === 'SAMPLING POINT' || u === 'POINT';
      });
      if (sampleNameColIndex === -1) sampleNameColIndex = 1;
      let controlColIndex = headers.findIndex(h => h.toUpperCase().includes('CONTROL #') || h.toUpperCase().includes('CONTROL'));
      if (controlColIndex === -1) controlColIndex = 0;

      for (let i = headerRowIndex + 1; i < Math.max(allRows.length + 50, 5000); i++) {
        const r = allRows[i] || [];
        const ctrl = r[controlColIndex] ? String(r[controlColIndex]).trim() : '';
        const smpl = r[sampleNameColIndex] ? String(r[sampleNameColIndex]).trim() : '';
        
        if (!ctrl && !smpl) {
          emptyRowIndex = i;
          break;
        }
      }

      const valuesToAppend = isBulk ? rowDataArray.map(row => row.map(v => v === null ? '' : v)) : [rowData.map(v => v === null ? '' : v)];

      if (emptyRowIndex !== -1) {
        sheetRowNumber = emptyRowIndex + 1;
        try {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${sheetTab}'!A${sheetRowNumber}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: valuesToAppend
            }
          });
          success = true;
          message = isBulk ? 'Bulk inserted into empty rows' : 'Inserted into first empty row';
        } catch (updateErr: any) {
          if (updateErr.message && updateErr.message.includes('exceeds grid limits')) {
            await sheets.spreadsheets.values.append({
              spreadsheetId,
              range: `'${sheetTab}'!A1`,
              valueInputOption: 'USER_ENTERED',
              insertDataOption: 'INSERT_ROWS',
              requestBody: {
                values: valuesToAppend
              }
            });
            success = true;
            message = isBulk ? 'Bulk appended (fallback)' : 'Row appended (fallback after grid limit)';
          } else {
            throw updateErr;
          }
        }
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'${sheetTab}'!A1`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: valuesToAppend
          }
        });
        success = true;
        message = isBulk ? 'Bulk appended' : 'Row appended';
      }
    }

    // --- SUPABASE DUAL WRITE ---
    if (success && supabase) {
      try {
        let fullPayloadData: Record<string, any> = {};
        
        if (typeof sheetRowNumber !== 'undefined' && sheetRowNumber !== -1 && finalRowData && headers) {
           // On update, use the full merged row data so we don't insert partial records
           headers.forEach((h: string, i: number) => {
              fullPayloadData[h] = finalRowData[i] || '';
           });
           
           // Single update case for supabase
           const sampleNameStr = String(
             fullPayloadData['SAMPLE NAME'] || 
             fullPayloadData['SAMPLE'] || 
             fullPayloadData['WATER SOURCE'] || 
             fullPayloadData['SAMPLING POINT'] || 
             fullPayloadData['POINT'] || 
             'Unknown'
           ).trim();

           await supabase
             .from('samples')
             .upsert({
               control_number: controlNumber,
               sample_name: sampleNameStr,
               sample_type: sampleType || 'UNKNOWN',
               sheet_tab: sheetTab,
               status: fullPayloadData['STATUS'] || fullPayloadData['Status'] || 'ON GOING',
               sheet_data: fullPayloadData,
               updated_at: new Date().toISOString()
             }, { onConflict: 'control_number,sample_name' });
        } else {
           // On insert, loop over all items for supabase dual write
           const supabasePayloads = items.map((item, index) => {
             const pd: any = {};
             headers.forEach((h: string, i: number) => {
                pd[h] = rowDataArray[index][i] || '';
             });
             const sName = String(pd['SAMPLE NAME'] || pd['SAMPLE'] || pd['WATER SOURCE'] || pd['SAMPLING POINT'] || pd['POINT'] || 'Unknown').trim();
             return {
                control_number: item.controlNumber || controlNumber,
                sample_name: sName,
                sample_type: item.sampleType || sampleType || 'UNKNOWN',
                sheet_tab: item.sheetTab || sheetTab,
                status: pd['STATUS'] || pd['Status'] || 'ON GOING',
                sheet_data: pd,
                updated_at: new Date().toISOString()
             };
           });
           await supabase.from('samples').upsert(supabasePayloads, { onConflict: 'control_number,sample_name' });
        }
          
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
