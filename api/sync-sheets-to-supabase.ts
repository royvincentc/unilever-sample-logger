import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthClient } from './_sheets.js';
import { google } from 'googleapis';
import { supabase } from './_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { spreadsheetId } = req.query;
    if (!spreadsheetId) {
       return res.status(400).json({ error: 'spreadsheetId required in query params' });
    }

    if (!supabase) {
       return res.status(500).json({ error: 'Supabase not configured' });
    }

    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Get all tabs
    const sheetMeta = await sheets.spreadsheets.get({
      spreadsheetId: String(spreadsheetId)
    });
    
    const tabs = sheetMeta.data.sheets?.map(s => s.properties?.title).filter(Boolean) as string[];
    
    let totalSynced = 0;
    const syncedRecords = [];
    
    // 1. Collect all rows from all tabs first (to ensure no data loss if Google API fails)
    const allRowsToUpsert: any[] = [];

    for (const tab of tabs) {
       if (!tab.toUpperCase().includes('WATER') && !tab.toUpperCase().includes('SWAB') && !tab.toUpperCase().includes('RM') && !tab.toUpperCase().includes('AIR')) {
         continue;
       }

       const response = await sheets.spreadsheets.values.get({
         spreadsheetId: String(spreadsheetId),
         range: `'${tab}'`,
       });
       
       const rows = response.data.values || [];
       if (rows.length < 2) continue; // no data or only headers
       
       // Find header row (some sheets have headers on row 1 or 2)
       let headerRowIndex = rows.findIndex((r: any[]) => r.some(c => typeof c === 'string' && (c.toUpperCase().includes('CONTROL #') || c.toUpperCase().includes('SAMPLE'))));
       if (headerRowIndex === -1) headerRowIndex = 0;

       const headers = rows[headerRowIndex] as string[];
       
       for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const rowData = rows[i];
          const payloadData: Record<string, any> = {};
          
          headers.forEach((h, idx) => {
             if (h) {
                payloadData[h] = rowData[idx] || '';
             }
          });
          
          payloadData['__rawRow'] = rowData;
          payloadData['_rowIndex'] = i + 1; // 1-indexed for sheets

          
          let controlNumber = payloadData['CONTROL #'] || payloadData['CONTROL'] || payloadData['CUC'];
          if (!controlNumber || String(controlNumber).trim() === '') continue;
          
          controlNumber = String(controlNumber).replace(/^RM-?/i, '').trim();

          const sampleNameStr = String(
            payloadData['SAMPLE NAME'] || 
            payloadData['SAMPLE'] || 
            payloadData['WATER SOURCE'] || 
            payloadData['SAMPLING POINT'] || 
            payloadData['POINT'] || 
            'Unknown'
          ).trim();

          let sampleType = 'UNKNOWN';
          if (tab.toUpperCase().includes('WATER')) sampleType = 'WATER';
          else if (tab.toUpperCase().includes('SWAB')) sampleType = 'ENVI';
          else if (tab.toUpperCase().includes('AIR')) sampleType = 'AIR';
          else if (tab.toUpperCase().includes('RM')) sampleType = 'RawMats';

          allRowsToUpsert.push({
            control_number: controlNumber,
            sample_name: sampleNameStr,
            sample_type: sampleType,
            sheet_tab: tab,
            status: payloadData['STATUS'] || payloadData['Status'] || 'ON GOING',
            sheet_data: payloadData,
            updated_at: new Date().toISOString()
          });
          
          syncedRecords.push(controlNumber);
       }
    }
    
    // 2. Safely wipe the existing Supabase table now that we have all data perfectly formatted
    if (allRowsToUpsert.length > 0) {
       const { error: delErr } = await supabase.from('samples').delete().neq('control_number', 'DELETE_ALL_HACK');
       if (delErr) {
           console.error('Delete error:', delErr);
           return res.status(500).json({ error: 'Failed to clear existing records', details: delErr });
       }
       
       // 3. Batch upsert the new fresh rows
       const chunkSize = 1000;
       for (let i = 0; i < allRowsToUpsert.length; i += chunkSize) {
           const chunk = allRowsToUpsert.slice(i, i + chunkSize);
           const { error: upsertErr } = await supabase
             .from('samples')
             .upsert(chunk, { onConflict: 'control_number,sample_name' });
             
           if (upsertErr) {
               console.error('Batch upsert error:', upsertErr);
           } else {
               totalSynced += chunk.length;
           }
       }
    }

    return res.status(200).json({ success: true, totalSynced, sampleOutput: syncedRecords.slice(0, 10) });

  } catch (error: any) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
