import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSheetsClient } from './_sheets.js';
import { supabase } from './_supabase.js';
import { mapSampleColumns, resolveColumn, SAMPLE_IDENTITY_HEADERS, sheetColumnLetter, validateSheetOverrides } from '../src/utils/sheetPayload.js';

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
    const items = isBulk ? payload.items : [payload];
    const basePayload = items[0];
    if (!basePayload) return res.status(400).json({ error: 'No samples to submit.' });
    
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

    const headers = rows[headerRowIndex].map(header => String(header ?? ''));
    if (!headers || headers.length === 0) {
      return res.status(404).json({ error: `Sheet tab '${sheetTab}' has no headers.` });
    }

    // 2. Prepare the row arrays matching the header order
    const isSampleLogger = basePayload.sampleLogger === true;
    const overrides = payload.sheetOverrides ?? [];
    if (isSampleLogger) {
      const error = validateSheetOverrides(overrides, headers, sampleType);
      if (error) return res.status(422).json({ error });
      if (items.some(item => !item || item.sampleLogger !== true || item.sampleType !== sampleType ||
          item.sheetTab !== sheetTab || item.spreadsheetId !== spreadsheetId || item.controlNumber !== controlNumber)) {
        return res.status(400).json({ error: 'Samples in a batch must share a destination and control number.' });
      }
    }
    const mappedItems = items.map(item => {
      if (!isSampleLogger) return item;
      const { spreadsheetId, sheetTab, sampleType, isUpdate, sampleLogger, sheetOverrides, selectedSamples,
        categories, samplingPoints, ...fields } = item;
      return mapSampleColumns(fields, headers, overrides);
    });
    const rowDataArray = mappedItems.map(item => {
      return headers.map(header => header && Object.hasOwn(item, header) &&
        item[header] !== undefined ? String(item[header]) : null);
    });
    const rowData = rowDataArray[0]; // for backward compatibility in single mode

    let success = false;
    let message = '';
    let finalRowData: string[] | null = null;
    let sheetRowNumber = -1;

    // We will always try to find an existing row to update first, even if isUpdate is false.
    // This allows users to pre-fill Sample Names in the sheet, and the app will fill in the rest.
    
    // 1. Identify Target Control Number and Target Sample Name
    const cleanControl = (value: unknown) => {
      const cleaned = String(value ?? '').trim().replace(/^RM-?/i, '').toLowerCase();
      return isSampleLogger && sampleType === 'WATER' ? cleaned.replace(/^w(?=\d)/, '') : cleaned;
    };
    const targetCleanCtrl = cleanControl(controlNumber);
    const target = mappedItems[0];
    const sampleNameColIndex = headers.findIndex((header, index) =>
      SAMPLE_IDENTITY_HEADERS.includes(header.trim().toUpperCase()) && (!isSampleLogger || !!rowData[index]));
    const controlHeader = resolveColumn('controlNumber', headers);
    const controlColIndex = controlHeader ? headers.indexOf(controlHeader) : -1;
    const readSample = (row: (string | null)[]) => String(row[sampleNameColIndex === -1 ? 1 : sampleNameColIndex] ?? '').trim();
    const targetCleanSample = readSample(rowData).toLowerCase();
    if (isSampleLogger && (sampleNameColIndex === -1 || controlColIndex === -1 ||
        rowDataArray.some(row => !readSample(row) || !row[controlColIndex]))) {
      return res.status(422).json({ error: 'The sheet must have a control number and sample column for every submitted row.' });
    }

    // 2. Fetch all rows to scan for a match, or to find the first empty row
    const endColumn = sheetColumnLetter(headers.length);
    const allRowsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTab}'!A:${endColumn}`,
    });
    const allRows = allRowsResponse.data.values || [];

    if (isSampleLogger) {
      const rowsBySample = new Map<string, number>();
      const reservedRows: number[] = [];
      const availableRows: number[] = [];
      let lastControl = '';
      for (let index = headerRowIndex + 1; index < allRows.length; index++) {
        const existing = allRows[index] ?? [];
        const control = cleanControl(existing[controlColIndex]);
        if (control) lastControl = control;
        const sample = readSample(existing).toLowerCase();
        const emptySample = ['', '-', 'undefined', 'null'].includes(sample);
        if (!emptySample && lastControl === targetCleanCtrl && !rowsBySample.has(sample)) {
          rowsBySample.set(sample, index + 1);
        } else if (emptySample) {
          if (control === targetCleanCtrl) reservedRows.push(index + 1);
          else if (!control) availableRows.push(index + 1);
        }
      }

      let nextRow = allRows.length + 1;
      const data = rowDataArray.map(values => {
        const existingRow = rowsBySample.get(readSample(values).toLowerCase());
        const row = existingRow ?? reservedRows.shift() ?? availableRows.shift() ?? nextRow++;
        if (existingRow && !allRows[existingRow - 1]?.[controlColIndex]) values[controlColIndex] = null;
        return { range: `'${sheetTab}'!A${row}:${endColumn}${row}`, values: [values] };
      });
      const write = () => sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: 'USER_ENTERED', includeValuesInResponse: true, data },
      });
      const written = await write().catch(async (error: unknown) => {
        if (!(error instanceof Error) || !error.message.includes('exceeds grid limits')) throw error;
        const workbook = await sheets.spreadsheets.get({
          spreadsheetId,
          ranges: [`'${sheetTab}'`],
          fields: 'sheets(properties(sheetId,title,gridProperties(rowCount)))',
        });
        const properties = workbook.data.sheets?.find(sheet => sheet.properties?.title === sheetTab)?.properties;
        const rowCount = properties?.gridProperties?.rowCount;
        if (properties?.sheetId == null || rowCount == null || nextRow - 1 <= rowCount) throw error;
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ appendDimension: {
            sheetId: properties.sheetId, dimension: 'ROWS', length: nextRow - 1 - rowCount,
          } }] },
        });
        return write();
      });

      if (supabase) {
        try {
          const records = rowDataArray.map((values, index) => {
            const writtenValues = written.data.responses?.[index]?.updatedData?.values?.[0] ?? values;
            const sheetData = Object.fromEntries(headers.map((header, position) => [header, writtenValues[position] ?? '']));
            return {
              control_number: controlNumber,
              sample_name: readSample(values),
              sample_type: sampleType,
              sheet_tab: sheetTab,
              status: sheetData.STATUS || sheetData.Status || 'ON GOING',
              sheet_data: sheetData,
              updated_at: new Date().toISOString(),
            };
          });
          const { error } = await supabase.from('samples').upsert(records, { onConflict: 'control_number,sample_name' });
          if (error) console.error('Supabase dual-write error:', error);
        } catch (error) {
          console.error('Supabase dual-write error:', error);
        }
      }
      return res.status(200).json({ success: true, message: 'Samples saved', controlNumber });
    }

    if (payload._rowIndex && isUpdate) {
      sheetRowNumber = parseInt(payload._rowIndex, 10);
    } else {
      let lastControlNumber = '';
      
      for (let i = headerRowIndex + 1; i < allRows.length; i++) {
        const r = allRows[i] || [];
        
        // Track last control number for merged cells
        const rawCtrl = String(r[controlColIndex === -1 ? 0 : controlColIndex] ?? '').trim();
        if (rawCtrl) {
          lastControlNumber = rawCtrl.replace(/^RM-?/i, '').toLowerCase().trim();
        }
        
        const rowSample = readSample(r).toLowerCase();
        
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
      const existingRowResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetTab}'!A${sheetRowNumber}:${endColumn}${sheetRowNumber}`
      });
      
      const existingRowData = existingRowResponse.data.values?.[0] || [];
      
      finalRowData = headers.map((header, i) => {
        if (target[header] !== undefined) {
           return String(target[header]);
        }
        return existingRowData[i] || '';
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
      
      for (let i = headerRowIndex + 1; i < Math.max(allRows.length + 50, 5000); i++) {
        if (!readSample(allRows[i] || [])) {
          emptyRowIndex = i;
          break;
        }
      }

      const valuesToAppend = isBulk ? rowDataArray.map(row => row.map(v => v === null ? '' : v)) : [rowData.map(v => v === null ? '' : v)];

      if (emptyRowIndex !== -1) {
        sheetRowNumber = emptyRowIndex + 1;
        
        const mergedValuesToAppend = isBulk
          ? rowDataArray.map((row, j) => {
              const existingRow = allRows[emptyRowIndex + j] || [];
              return row.map((v, idx) => v === null ? (existingRow[idx] || '') : v);
            })
          : [rowData.map((v, idx) => v === null ? ((allRows[emptyRowIndex] || [])[idx] || '') : v)];

        try {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${sheetTab}'!A${sheetRowNumber}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: mergedValuesToAppend
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
             fullPayloadData['SAMPLE DESCRIPTION'] ||
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
             const sName = readSample(rowDataArray[index]) || 'Unknown';
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
