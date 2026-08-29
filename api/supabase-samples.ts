import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    try {
      let query = supabase
        .from('samples')
        .select('id, control_number, sample_name, sample_type, sheet_data, sheet_tab')
        .order('updated_at', { ascending: false });

      // Support basic filtering
      if (req.query.sample_type) {
        query = query.eq('sample_type', req.query.sample_type);
      }
      if (req.query.limit) {
        query = query.limit(Number(req.query.limit));
      } else {
        query = query.limit(200); // Higher limit for table view
      }

      const { data, error } = await query;

      if (error) throw error;
      return res.status(200).json(data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, sheet_data, control_number, sample_name, sample_type } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing id' });

      const updates: any = {};
      if (sheet_data !== undefined) updates.sheet_data = sheet_data;
      if (control_number !== undefined) updates.control_number = control_number;
      if (sample_name !== undefined) updates.sample_name = sample_name;
      if (sample_type !== undefined) updates.sample_type = sample_type;
      
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('samples')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
