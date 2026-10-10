import type { VercelRequest, VercelResponse } from '@vercel/node';
import { membership, safeFailure, HttpError } from './_collaborationAuth.js';
import { supabase } from './_supabase.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control','no-store');
  try {
    if (req.method !== 'GET') throw new HttpError(405,'Method not allowed.');
    const member = await membership(req);
    const { data, error } = await supabase!.from('collab_workspaces').select('id,name').eq('id',member.workspaceId).single();
    if (error) throw error;
    res.json({ workspace: { ...data, role: member.role, uid: member.uid } });
  } catch (error) { const e=safeFailure(error); res.status(e.status).json({ error:e.message }); }
}
