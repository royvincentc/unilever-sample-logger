import type { VercelRequest,VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';
import { supabase } from './_supabase.js';
import { processDriveJobs } from './_driveWorker.js';
export default async function handler(req:VercelRequest,res:VercelResponse) {
  const expected=process.env.CRON_SECRET?Buffer.from(`Bearer ${process.env.CRON_SECRET}`):undefined,actual=Buffer.from(req.headers.authorization||'');
  if(req.method!=='GET'||!expected||actual.length!==expected.length||!timingSafeEqual(expected,actual))return res.status(401).json({error:'Unauthorized worker request.'});
  if(!supabase)return res.status(503).json({error:'Storage unavailable.'});
  const {data:jobs,error}=await supabase.from('collab_drive_jobs').select('id').in('status',['pending','failed','saving']).lte('next_attempt',new Date().toISOString()).order('next_attempt').limit(3);
  if(error)return res.status(500).json({error:'Could not read checkpoint queue.'});
  res.json({outcomes:await processDriveJobs(jobs||[])});
}
