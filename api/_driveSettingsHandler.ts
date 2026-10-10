import type { VercelRequest,VercelResponse } from '@vercel/node';
import { membership,safeFailure,HttpError } from './_collaborationAuth.js';
import { validateFolder } from './_drive.js';
import { supabase } from './_supabase.js';
export default async function handler(req:VercelRequest,res:VercelResponse) {
  res.setHeader('Cache-Control','no-store');
  try {
    if(!['GET','POST'].includes(req.method||''))throw new HttpError(405,'Method not allowed.');
    const member=await membership(req,req.method==='POST',req.method==='POST');
    if(req.method==='GET'){const {data,error}=await supabase!.from('collab_drive_destinations').select('folder_id,drive_id,updated_at').eq('workspace_id',member.workspaceId).maybeSingle();if(error)throw error;return res.json({destination:data});}
    let folder;try{folder=await validateFolder(req.body.folderId);}catch(e){throw new HttpError(400,(e as Error).message);}
    const {error}=await supabase!.from('collab_drive_destinations').upsert({workspace_id:member.workspaceId,folder_id:folder.id,drive_id:folder.driveId,configured_by:member.uid,updated_at:new Date().toISOString()});if(error)throw error;
    res.json({destination:{folder_id:folder.id,drive_id:folder.driveId},message:'Destination configured. Existing folder permissions apply; no sharing permissions were changed.'});
  }catch(error){const e=safeFailure(error);res.status(e.status).json({error:e.message});}
}
