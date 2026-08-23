import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const payload = req.body;
    const { controlNumber, sheetTab, sampleType, ...sheetData } = payload;
    
    if (!controlNumber) return res.status(400).json({ error: 'Missing controlNumber' });
    if (!supabase) return res.status(500).json({ error: 'Supabase client not configured' });
    
    // Find sample name (it's usually the second key in the payload after controlNumber, sheetTab, sampleType)
    const keys = Object.keys(sheetData);
    // Keys like CONTROL # are already removed if they match EXACTLY, but wait, the GAS script sends the exact headers.
    // The control number header might still be in sheetData.
    // We can just grab the second key in the raw payload.
    const rawKeys = Object.keys(payload);
    const sampleNameStr = rawKeys.length > 2 ? String(payload[rawKeys[2]]).trim() : 'Unknown';

    // UPSERT to Supabase
    const { data, error } = await supabase.from('samples').upsert({
      control_number: controlNumber,
      sample_name: sampleNameStr,
      sample_type: sampleType || 'UNKNOWN',
      sheet_tab: sheetTab,
      status: payload['STATUS'] || payload['Status'] || payload.status || 'ON GOING',
      sheet_data: sheetData,
      updated_at: new Date().toISOString()
    }, { onConflict: 'control_number,sample_name' });
    
    if (error) throw error;
    
    return res.status(200).json({ success: true, message: 'Supabase updated from Sheets' });
  } catch (error: any) {
    console.error('Sheet Webhook Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
