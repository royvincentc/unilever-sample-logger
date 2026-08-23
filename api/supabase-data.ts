import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { tab } = req.query;
    if (!tab || typeof tab !== 'string') return res.status(400).json({ error: 'Missing tab' });
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

    const { data: supabaseRows, error } = await supabase.from('samples').select('sheet_data').eq('sheet_tab', tab).order('updated_at', { ascending: false });
    if (error) throw error;

    const data = supabaseRows.map(r => r.sheet_data);
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}