import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { initializeApp,cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@supabase/supabase-js';
// An explicit roster file avoids placing identities/secrets in shell history.
const path=process.argv[2];
if(!path || !process.env.FIREBASE_ADMIN_CREDENTIALS || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Provide a roster JSON file and server credentials.');
const roster=JSON.parse(await readFile(path,'utf8'));
if(!roster.workspaceId || !roster.name || !Array.isArray(roster.members) || !roster.members.some((m:any)=>m.role==='admin')) throw new Error('A workspace and explicit administrator are required.');
const app=initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS))});
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
for(const m of roster.members) {
  if(!['admin','editor','viewer'].includes(m.role) || typeof m.uid!=='string') throw new Error('Invalid member.');
  const user=await getAuth(app).getUser(m.uid);
  if(!user.providerData.some(p=>p.providerId==='google.com') || !user.emailVerified) throw new Error('Each member must have a verified Google identity.');
}
const workspace=await db.from('collab_workspaces').upsert({id:roster.workspaceId,name:roster.name});if(workspace.error)throw workspace.error;
for(const m of roster.members) {
  const user=await getAuth(app).getUser(m.uid);
  await getAuth(app).setCustomUserClaims(m.uid,{...user.customClaims,role:'authenticated'});
  const result=await db.from('collab_memberships').upsert({workspace_id:roster.workspaceId,uid:m.uid,role:m.role,active:true});if(result.error)throw result.error;
}
console.log(`Provisioned ${roster.members.length} explicit members. Refresh Firebase tokens before connecting.`);
