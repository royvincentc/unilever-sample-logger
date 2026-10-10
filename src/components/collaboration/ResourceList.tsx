import { useEffect,useState,useRef } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import { Plus,ArrowRight,Trash2,RotateCcw } from 'lucide-react';
import { endpoint,request,workspaceId } from '../../utils/collaboration/client';
import type { Resource,Workspace } from '../../types/collaboration';
import Button from '../ui/Button';
export default function ResourceList({kind,workspace}:{kind:'board'|'drawing';workspace:Workspace}) {
  const [resources,setResources]=useState<Resource[]>([]),[name,setName]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[trash,setTrash]=useState(false);
  const navigate=useNavigate(),input=useRef<HTMLInputElement>(null),editable=workspace.role!=='viewer';
  const route=kind==='board'?'/kanban':'/whiteboard';
  const load=async()=>{try{const r=await request(endpoint());setResources(r.resources);setError('');}catch(e){setError((e as Error).message);}};
  useEffect(()=>{void load();},[]);
  const create=async(data?:any,importName?:string)=>{
    setBusy(true);try {const id=crypto.randomUUID();await request(endpoint(),{workspaceId:workspace.id,operation:{id:crypto.randomUUID(),resourceId:id,generation:1,type:'resource.create',payload:{kind,name:importName||name|| (kind==='board'?'Untitled board':'Untitled drawing'),importData:data},createdAt:new Date().toISOString()}});navigate(`${route}/${id}`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const recover=async(r:Resource)=>{try{await request(endpoint(),{workspaceId:workspace.id,operation:{id:crypto.randomUUID(),resourceId:r.id,generation:r.generation,type:'resource.restore',payload:{},createdAt:new Date().toISOString()}});await load();}catch(e){setError((e as Error).message);}};
  return <div className="collab-library"><div className="collab-toolbar"><div><h1>{kind==='board'?'Shared boards':'Shared drawings'}</h1><p>QC microbiology · {workspace.role} access</p></div><button className="lab-button secondary" onClick={()=>setTrash(!trash)}>{trash?<ArrowRight size={16}/>:<Trash2 size={16}/>} {trash?'Back to workspace':'Trash'}</button></div>
    {editable&&!trash&&<form className="collab-create" onSubmit={e=>{e.preventDefault();void create();}}><label htmlFor="resource-name">{kind==='board'?'Board name':'Drawing name'}</label><div><input id="resource-name" value={name} onChange={e=>setName(e.target.value)} maxLength={200} placeholder={kind==='board'?'e.g. Laboratory priorities':'e.g. Workflow sketch'}/><Button type="submit" loading={busy} icon={<Plus size={16}/>}>Create {kind==='board'?'board':'drawing'}</Button><button type="button" className="lab-button secondary" onClick={()=>input.current?.click()}>Import snapshot</button></div><input ref={input} type="file" accept=".json,.excalidraw" hidden onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>3_000_000)throw new Error('Snapshot must be smaller than 3 MB.');const parsed=JSON.parse(await file.text());if(kind==='board'){if(parsed.type!=='sample-logger-kanban'||parsed.schemaVersion!==1)throw new Error('Choose a canonical Kanban snapshot.');await create(parsed.resource.data,parsed.resource.name);}else{if(parsed.type!=='excalidraw')throw new Error('Choose an Excalidraw file.');const {restoreElements}=await import('@excalidraw/excalidraw');await create({columns:[],notes:[],elements:restoreElements(parsed.elements,null),files:parsed.files||{}},file.name.replace(/\.excalidraw$/,''));}}catch(err){setError((err as Error).message);}e.target.value='';}}/></form>}
    {error&&<p className="collab-error" role="alert">{error}<button onClick={()=>void load()}>Retry</button></p>}
    <div className="collab-resource-list">{resources.filter(r=>r.kind===kind&&Boolean(r.deleted_at)===trash).map(r=><div className="collab-resource-row" key={r.id}><div><h2>{r.name}</h2><p>Revision {r.revision} · {new Date(r.updated_at).toLocaleDateString()}</p></div>{trash?(editable&&<button className="lab-button secondary" onClick={()=>void recover(r)}><RotateCcw size={16}/>Restore</button>):<Link className="lab-button secondary" to={`${route}/${r.id}`}>Open <ArrowRight size={16}/></Link>}</div>)}</div>
    {!resources.some(r=>r.kind===kind&&Boolean(r.deleted_at)===trash)&&<div className="collab-empty"><h2>{trash?'Trash is empty':kind==='board'?'Make room for the next idea':'Start with a blank canvas'}</h2><p>{trash?'Deleted resources remain recoverable here.':editable?'Create a shared resource above. Everyone in your workspace will see it.':'Your team’s shared resources will appear here.'}</p></div>}
  </div>;
}
