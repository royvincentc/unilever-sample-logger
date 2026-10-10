import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { initialData,applyOperation,OperationError,importData } from '../../src/utils/collaboration/protocol';
import type { Resource } from '../../src/types/collaboration';
import * as Y from 'yjs';
import { toBase64 } from '../../src/utils/collaboration/protocol';
const boardId='11111111-1111-4111-8111-111111111111',drawingId='22222222-2222-4222-8222-222222222222';
function fixtures(){const base=(id:string,kind:'board'|'drawing'):Resource=>({id,workspace_id:'fixture',kind,name:kind==='board'?'Laboratory priorities':'Laboratory workflow',revision:1,generation:1,deleted_at:null,updated_at:new Date().toISOString(),data:initialData(kind)});const board=base(boardId,'board');for(let i=0;i<8;i++)board.data.notes.push({id:`fixture-note-${i}`,title:['Review swab results','Update sampling schedule','Prepare growth media','Calibrate incubator'][i%4],body:'',textState:'',color:['yellow','blue','green','pink'][i%4] as any,columnId:board.data.columns[i%3].id,generation:1,versions:{title:0,color:0}});return new Map([[boardId,board],[drawingId,base(drawingId,'drawing')]]);}
export default defineConfig({plugins:[react(),tailwind(),{name:'isolated-collaboration-fixture',configureServer(server){let resources=fixtures(),receipts=new Map<string,any>();const presence=new Map<string,any>();server.middlewares.use(async(req,res,next)=>{
 if(!req.url?.startsWith('/api/')){if(req.headers.accept?.includes('text/html')){const requestedRole=new URL(req.url,'http://localhost').searchParams.get('role');if(requestedRole&&['editor','editor2','viewer','admin'].includes(requestedRole))res.setHeader('Set-Cookie',`collab_session=${encodeURIComponent(`fixture:${requestedRole}`)}; Path=/; SameSite=Lax`);req.url='/tools/collaboration/index.html';}return next();}
 const url=new URL(req.url,'http://localhost'),cookie=String(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith('collab_session=')),role=decodeURIComponent(cookie?.slice('collab_session='.length)||'').replace(/^fixture:/,'');res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');const respond=(code:number,body:any)=>{res.statusCode=code;res.end(JSON.stringify(body));};
 if(!['editor','editor2','viewer','admin'].includes(role))return respond(401,{error:'Fixture authentication required.'});
 let raw='';for await(const part of req)raw+=part;let body:any;try{body=raw?JSON.parse(raw):{};}catch{return respond(400,{error:'Invalid JSON.'});}
 if(url.pathname==='/api/fixture-reset'){resources=fixtures();receipts.clear();return respond(200,{ok:true});}
 if(url.pathname==='/api/fixture-profile'){
  const resource=resources.get(boardId)!;resource.data.columns=Array.from({length:body.columns||3},(_,i)=>({id:`profile-column-${i}`,title:`Column ${i+1}`,generation:1}));
  const doc=new Y.Doc();doc.getText('body').insert(0,'Review sampling records, confirm results and record any follow-up work needed for the next laboratory shift.');const textState=toBase64(Y.encodeStateAsUpdate(doc));doc.destroy();
  resource.data.notes=Array.from({length:Math.min(body.count||100,5000)},(_,i)=>({id:`profile-note-${i}`,title:`Laboratory task ${i+1}`,body:'Review sampling records, confirm results and record any follow-up work needed for the next laboratory shift.',textState,color:['yellow','blue','green','pink'][i%4],columnId:resource.data.columns[i%resource.data.columns.length].id,generation:1,versions:{title:0,color:0}} as any));resource.revision++;return respond(200,{bytes:JSON.stringify(resource).length,notes:resource.data.notes.length});
 }
 if(url.pathname==='/api/workspace')return respond(200,{workspace:{id:'fixture',name:'QC microbiology',role:role==='editor2'?'editor':role,uid:role}});
 if(url.pathname.includes('drive'))return respond(503,{error:'Synthetic preview: live Drive saving is not configured.'});
 if(req.method==='GET'){
  if(url.searchParams.has('presence'))return respond(200,{presence:[...presence.values()].filter(p=>p.resourceId===url.searchParams.get('presence')&&Date.parse(p.expires_at)>Date.now())});
  if(url.searchParams.has('id')){const resource=resources.get(url.searchParams.get('id')!);return respond(resource?200:404,resource?{resource,member:{role}}:{error:'Not found.'});}
  return respond(200,{resources:[...resources.values()].map(r=>({...r,data:undefined})),member:{role}});
 }
 if(body.action==='presence'){presence.set(`${role}:${body.session}`,{uid:role,name:`Demo ${role}`,session:body.session,cursor:body.cursor,resourceId:body.resourceId,expires_at:new Date(Date.now()+12000).toISOString()});return respond(200,{ok:true});}
 if(role==='viewer')return respond(403,{error:'Viewer mutations are rejected.'});
 try{const op=body.operation;if(!op)return respond(400,{error:'Missing operation.'});const old=receipts.get(op.id);if(old){if(old.hash!==JSON.stringify(op))return respond(409,{error:'Operation ID conflict.'});return respond(200,old.result);}let resource=resources.get(op.resourceId);if(op.type==='resource.create'){resource={id:op.resourceId,workspace_id:'fixture',kind:op.payload.kind,name:op.payload.name,revision:1,generation:1,deleted_at:null,updated_at:new Date().toISOString(),data:op.payload.importData?importData(op.payload.kind,op.payload.importData):initialData(op.payload.kind)};}else {if(!resource)return respond(404,{error:'Resource not found.'});resource=applyOperation(resource,op);}resources.set(resource.id,resource);const result={resource};receipts.set(op.id,{hash:JSON.stringify(op),result});return respond(200,result);}catch(e){return respond(e instanceof OperationError?e.status:500,{error:(e as Error).message});}
 });}}],resolve:{alias:[{find:/.*\/utils\/firebase$/,replacement:resolve('tools/collaboration/fixture-auth.ts')},{find:/^\.\.\/firebase$/,replacement:resolve('tools/collaboration/fixture-auth.ts')},{find:/^\.\/firebase$/,replacement:resolve('tools/collaboration/fixture-auth.ts')}]},server:{host:'127.0.0.1',port:5191,strictPort:true}});
