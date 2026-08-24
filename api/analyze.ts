import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const fifteenMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data } = await supabase.from('samples').select('*').gte('updated_at', fifteenMinsAgo).order('updated_at', { ascending: false });

    return res.status(200).json({ 
        recentUpdates: data
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
