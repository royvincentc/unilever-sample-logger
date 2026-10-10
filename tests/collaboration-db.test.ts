import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initialData } from '../src/utils/collaboration/protocol';
test('SQL migration enforces memberships, receipts, atomic revisions and worker leases',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;`);
 await db.exec(await readFile('supabase/migrations/20261010025516_collaboration_foundation.sql','utf8'));
 const workspace=crypto.randomUUID(),id=crypto.randomUUID();
 await db.query('insert into collab_workspaces values($1,$2)',[workspace,'QC']);
 await db.query("insert into collab_memberships values($1,'editor','editor',true),($1,'viewer','viewer',true)",[workspace]);
 const r={id,workspace_id:workspace,kind:'board',name:'Test',revision:1,generation:1,deleted_at:null,data:initialData('board')};
 await db.exec('set role service_role');
 const commit=(actor:string,operation:string,hash:string,expected:number,resource:any)=>db.query('select collab_commit($1,$2,$3,$4,$5,$6::jsonb) as result',[workspace,actor,operation,hash,expected,JSON.stringify(resource)]);
 await assert.rejects(commit('viewer','denied','h',0,r),/permission_denied/);
 const saved:any=await commit('editor','one','h',0,r);assert.equal(saved.rows[0].result.resource.revision,1);
 const duplicate:any=await commit('editor','one','h',0,r);assert.deepEqual(duplicate.rows,saved.rows);
 await assert.rejects(commit('editor','one','different',0,r),/operation_id_conflict/);
 await assert.rejects(commit('editor','two','h',0,{...r,revision:2}),/revision_conflict/);
 await db.query('insert into collab_drive_destinations(workspace_id,folder_id,configured_by) values($1,$2,$3)',[workspace,'test-folder','editor']);
 await commit('editor','two','h',1,{...r,revision:2});
 const jobs:any=await db.query('select * from collab_drive_jobs');assert.equal(jobs.rows.length,1);
 await commit('editor','three','h',2,{...r,revision:3});
 const coalesced:any=await db.query('select * from collab_drive_jobs');assert.equal(coalesced.rows.length,1);assert.equal(coalesced.rows[0].revision,3);
 await db.query('update collab_drive_jobs set next_attempt=now() where id=$1',[coalesced.rows[0].id]);
 const claim:any=await db.query('select * from collab_claim_drive($1,$2)',[coalesced.rows[0].id,crypto.randomUUID()]);assert.equal(claim.rows.length,1);
 const other:any=await db.query('select * from collab_claim_drive($1,$2)',[coalesced.rows[0].id,crypto.randomUUID()]);assert.equal(other.rows.length,0);
 await db.exec('reset role');await db.exec('set role authenticated');
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:'viewer',iss:'https://securetoken.google.com/unilever-qc',email_verified:true,firebase:{sign_in_provider:'google.com'}})]);
 const visible=await db.query('select * from collab_resources');assert.equal(visible.rows.length,1);
 await assert.rejects(db.query("update collab_resources set name='bad'"),/permission denied/);
 await assert.rejects(commit('editor','forge','h',2,{...r,revision:3}),/permission denied/);
 await db.exec('reset role');await db.exec("update collab_memberships set active=false where uid='viewer'");await db.exec('set role authenticated');assert.equal((await db.query('select * from collab_resources')).rows.length,0);
 }finally{await db.close();}
});
