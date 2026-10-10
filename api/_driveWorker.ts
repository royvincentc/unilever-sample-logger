import { supabase } from './_supabase.js';
import { driveClient,validateFolder,immutableUpload,hashContent } from './_drive.js';
import { canonical,readableBoard } from '../src/utils/collaboration/export.js';
export async function processDriveJobs(candidates:Array<{id:string}>) {
 if(!supabase)throw new Error('Storage unavailable.');
  const outcomes=[];
  for(const candidate of candidates) {
    const fence=crypto.randomUUID(),{data:claimed,error:claimError}=await supabase.rpc('collab_claim_drive',{p_job:candidate.id,p_fence:fence});if(claimError||!claimed?.length)continue;const job=claimed[0];
    try {
      const {data:destination,error:destinationError}=await supabase.from('collab_drive_destinations').select('*').eq('workspace_id',job.workspace_id).single();if(destinationError||!destination)throw new Error('Drive destination is unavailable.');
      if(job.folder_id&&job.folder_id!==destination.folder_id)throw new Error('Destination changed. Review the retained checkpoint before retry.');
      await validateFolder(destination.folder_id);
      if(job.snapshot.kind==='drawing'&&!job.preview)throw new Error('Waiting for an idle drawing preview. Open the drawing, wait for synchronization, then retry this checkpoint.');
      const content=Buffer.from(JSON.stringify(canonical(job.snapshot))),hash=hashContent(content),allowCreate=!job.file_id;
      if(!job.file_id){const generated=await driveClient().files.generateIds({count:2,space:'drive',type:'files'});job.file_id=generated.data.ids![0];job.export_id=generated.data.ids![1];const result=await supabase.from('collab_drive_jobs').update({file_id:job.file_id,export_id:job.export_id,folder_id:destination.folder_id,content_hash:hash}).eq('id',job.id).eq('fence',fence).select('id');if(result.error||!result.data?.length)throw new Error('Checkpoint lease changed.');}
      const properties={app:'ul-sample-logger',workspace:job.workspace_id,resource:job.resource_id,checkpoint:job.id,hash};
      const result=await immutableUpload({id:job.file_id,folder:destination.folder_id,name:`${job.snapshot.name} - r${job.revision}.${job.snapshot.kind==='board'?'json':'excalidraw'}`,mime:'application/json',content,properties,allowCreate});
      if(job.snapshot.kind==='board')await immutableUpload({id:job.export_id,folder:destination.folder_id,name:`${job.snapshot.name} - r${job.revision}.html`,mime:'text/html',content:Buffer.from(readableBoard(job.snapshot)),properties:{...properties,hash:hashContent(readableBoard(job.snapshot))},allowCreate});
      if(job.snapshot.kind==='drawing'&&job.preview){const image=Buffer.from(job.preview.dataURL.split(',')[1],'base64');await immutableUpload({id:job.export_id,folder:destination.folder_id,name:`${job.snapshot.name} - r${job.revision}.png`,mime:'image/png',content:image,properties:{...properties,hash:hashContent(image)},allowCreate});}
      const complete=await supabase.from('collab_drive_jobs').update({status:'saved',file_version:result.version,saved_at:new Date().toISOString(),error:null,lease_until:null}).eq('id',job.id).eq('fence',fence).select('id');if(complete.error||!complete.data?.length)throw new Error('Checkpoint lease changed.');
      await supabase.from('collab_resources').update({drive_revision:job.revision,drive_status:'saved'}).eq('id',job.resource_id).eq('revision',job.revision).or(`drive_revision.is.null,drive_revision.lt.${job.revision}`);
      outcomes.push({id:job.id,status:'saved'});
    }catch(e){const message=(e as Error).message,conflict=/modified|moved|deleted|replaced|Destination changed/.test(message);await supabase.from('collab_drive_jobs').update({status:conflict?'conflict':'failed',error:message,next_attempt:new Date(Date.now()+Math.min(3600000,30000*2**Math.min(job.attempts,7))).toISOString(),lease_until:null}).eq('id',job.id).eq('fence',fence);await supabase.from('collab_resources').update({drive_status:conflict?'conflict':'failed'}).eq('id',job.resource_id).eq('revision',job.revision);outcomes.push({id:job.id,status:conflict?'conflict':'failed'});}
  }

return outcomes;
}
