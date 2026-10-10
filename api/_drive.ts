import { google } from 'googleapis';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
export function driveClient() {
  if(process.env.DRIVE_OAUTH_REFRESH_TOKEN) {const auth=new google.auth.OAuth2(process.env.DRIVE_OAUTH_CLIENT_ID,process.env.DRIVE_OAUTH_CLIENT_SECRET);auth.setCredentials({refresh_token:process.env.DRIVE_OAUTH_REFRESH_TOKEN});return google.drive({version:'v3',auth});}
  const raw=process.env.GCP_CREDENTIALS_JSON||process.env.GOOGLE_CREDENTIALS;
  if(!raw)throw new Error('Drive credentials are not configured.');
  return google.drive({version:'v3',auth:new google.auth.GoogleAuth({credentials:JSON.parse(raw),scopes:['https://www.googleapis.com/auth/drive']})});
}
export async function validateFolder(id:string) {
  if(!/^[\w-]{10,200}$/.test(id))throw new Error('Enter a valid Drive folder ID.');
  const {data}=await driveClient().files.get({fileId:id,fields:'id,name,mimeType,trashed,driveId,capabilities(canAddChildren)',supportsAllDrives:true});
  if(data.trashed||data.mimeType!=='application/vnd.google-apps.folder'||!data.capabilities?.canAddChildren)throw new Error('Choose a writable Drive folder.');
  if(!data.driveId&&!process.env.DRIVE_OAUTH_REFRESH_TOKEN)throw new Error('Use a Shared Drive folder for service-account saving, or configure user OAuth for My Drive.');
  return data;
}
export const hashContent=(content:Buffer|string)=>createHash('sha256').update(content).digest('hex');
export async function immutableUpload({id,folder,name,mime,content,properties,allowCreate=true,client}:{id:string;folder:string;name:string;mime:string;content:Buffer;properties:Record<string,string>;allowCreate?:boolean;client?:ReturnType<typeof driveClient>}) {
  const drive=client||driveClient();let existing:any;
  try{existing=(await drive.files.get({fileId:id,fields:'id,parents,trashed,version,md5Checksum,appProperties',supportsAllDrives:true})).data;}catch(e:any){if(e.code!==404)throw e;}
  if(existing) {
    if(existing.trashed||!existing.parents?.includes(folder)||existing.appProperties?.checkpoint!==properties.checkpoint)throw new Error('Drive checkpoint was moved, deleted or replaced. Review it before retry.');
    const downloaded=await drive.files.get({fileId:id,alt:'media',supportsAllDrives:true},{responseType:'arraybuffer'});
    if(hashContent(Buffer.from(downloaded.data as any))!==hashContent(content))throw new Error('Drive checkpoint was externally modified. No file was overwritten.');
    return existing;
  }
  if(!allowCreate)throw new Error('Drive checkpoint is missing after an uncertain upload. It may have been deleted; automatic recreation is disabled.');
  const {data}=await drive.files.create({requestBody:{id,name,parents:[folder],appProperties:properties},media:{mimeType:mime,body:Readable.from(content)},fields:'id,version,parents,appProperties',supportsAllDrives:true});
  const downloaded=await drive.files.get({fileId:id,alt:'media',supportsAllDrives:true},{responseType:'arraybuffer'});
  if(hashContent(Buffer.from(downloaded.data as any))!==hashContent(content))throw new Error('Drive verification failed. Checkpoint remains pending.');
  return data;
}
