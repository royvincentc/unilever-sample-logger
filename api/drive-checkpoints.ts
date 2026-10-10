import type { VercelRequest,VercelResponse } from '@vercel/node';
import { membership,safeFailure,HttpError } from './_collaborationAuth.js';
import { supabase } from './_supabase.js';
import { driveClient,hashContent } from './_drive.js';
import { processDriveJobs } from './_driveWorker.js';
export default async function handler(req:VercelRequest,res:VercelResponse) {
  res.setHeader('Cache-Control','no-store');
  try {
    if(!['GET','POST'].includes(req.method||''))throw new HttpError(405,'Method not allowed.');
    const member=await membership(req,req.method==='POST');
    if(req.method==='GET') {
      if(req.query.download){const {data,error}=await supabase!.from('collab_drive_jobs').select('file_id,folder_id,content_hash').eq('id',String(req.query.download)).eq('workspace_id',member.workspaceId).eq('status','saved').single();if(error||!data)throw new HttpError(404,'Checkpoint not found.');const drive=driveClient();const meta=(await drive.files.get({fileId:data.file_id,fields:'parents,trashed',supportsAllDrives:true})).data;if(meta.trashed||!meta.parents?.includes(data.folder_id))throw new HttpError(409,'The checkpoint was moved or deleted.');const result=await drive.files.get({fileId:data.file_id,alt:'media',supportsAllDrives:true},{responseType:'arraybuffer'});const content=Buffer.from(result.data as any);if(hashContent(content)!==data.content_hash)throw new HttpError(409,'The checkpoint was externally modified. Download and review it directly in Drive before importing a copy.');return res.json({snapshot:JSON.parse(content.toString('utf8'))});}
      const {data,error}=await supabase!.from('collab_drive_jobs').select('id,resource_id,revision,status,error,saved_at').eq('workspace_id',member.workspaceId).neq('status','superseded').order('revision',{ascending:false}).limit(100);if(error)throw error;return res.json({checkpoints:data});
    }
    const {data:destination}=await supabase!.from('collab_drive_destinations').select('folder_id').eq('workspace_id',member.workspaceId).maybeSingle();if(!destination)throw new HttpError(400,'Ask an administrator to configure a Drive destination first.');
    const {data:resource,error}=await supabase!.from('collab_resources').select('*').eq('id',req.body.resourceId).eq('workspace_id',member.workspaceId).single();if(error||!resource)throw new HttpError(404,'Resource not found.');
    let preview:any;
    if(req.body.action==='preview'){
      if(resource.kind!=='drawing'||req.body.revision!==resource.revision||typeof req.body.preview!=='string'||!req.body.preview.startsWith('data:image/png;base64,')||req.body.preview.length>1_000_000)throw new HttpError(400,'Invalid or stale preview.');
      preview={dataURL:req.body.preview,mimeType:'image/png'};
    }
    let jobQuery=supabase!.from('collab_drive_jobs').select('*').eq('resource_id',resource.id).eq('workspace_id',member.workspaceId);
    jobQuery=req.body.jobId?jobQuery.eq('id',req.body.jobId):jobQuery.eq('revision',resource.revision);
    const {data:job}=await jobQuery.maybeSingle();
    if(req.body.jobId&&!job)throw new HttpError(404,'Retained checkpoint not found.');
    if(job){if(job.status==='conflict')throw new HttpError(409,'This checkpoint has an external conflict. Review and recover it; automatic overwrite is disabled.');if(job.status!=='saving'){const updates=preview?{preview}:{next_attempt:new Date().toISOString(),status:job.status==='saved'?'saved':'pending'};const {error:updateError}=await supabase!.from('collab_drive_jobs').update(updates).eq('id',job.id);if(updateError)throw updateError;}}
    else {const {error:insertError}=await supabase!.from('collab_drive_jobs').insert({workspace_id:member.workspaceId,resource_id:resource.id,revision:resource.revision,snapshot:resource,next_attempt:new Date(Date.now()+(preview?30000:0)).toISOString(),preview});if(insertError)throw insertError;}
    if(req.body.action==='preview')return res.json({message:'Idle preview stored for the pending checkpoint.'});
    const {data:queued}=await supabase!.from('collab_drive_jobs').select('id').eq('resource_id',resource.id).eq('revision',job?.revision||resource.revision).single();
    const outcomes=queued?await processDriveJobs([queued]):[];
    res.json({message:job?.status==='saved'||outcomes.some(o=>o.status==='saved')?'Drive checkpoint saved and verified.':'Checkpoint retained. Inspect its status in Settings; failed attempts can be retried.',outcomes});
  }catch(error){const e=safeFailure(error);res.status(e.status).json({error:e.message});}
}
