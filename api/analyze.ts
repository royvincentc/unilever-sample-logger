import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { data, error, count } = await supabase.from('samples').select('*', { count: 'exact' });
    
    if (error) throw error;

    const grouped: Record<string, any[]> = {};
    for (const r of data) {
        if (!grouped[r.control_number]) grouped[r.control_number] = [];
        grouped[r.control_number].push(r);
    }
    
    let dupCount = 0;
    const sampleDups = [];
    
    for (const [ctrl, rows] of Object.entries(grouped)) {
        if (rows.length > 1) {
            dupCount++;
            if (dupCount <= 10) {
                sampleDups.push({
                    control_number: ctrl,
                    rows: rows.map(r => ({
                        id: r.id,
                        sample_name: r.sample_name,
                        created_at: r.created_at,
                        updated_at: r.updated_at
                    }))
                });
            }
        }
    }

    return res.status(200).json({ 
        totalRecords: count, 
        duplicatedControlNumbers: dupCount, 
        samples: sampleDups 
    });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
