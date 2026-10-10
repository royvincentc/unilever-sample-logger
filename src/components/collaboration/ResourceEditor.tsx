import { lazy,Suspense,useState,useRef,useCallback } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import { ArrowLeft,Trash2,Save,RotateCcw } from 'lucide-react';
import { useCollaboration } from '../../hooks/useCollaboration';
import { canonical,download,readableBoard,boardCsv } from '../../utils/collaboration/export';
import type { Workspace,Conflict } from '../../types/collaboration';
import { beginGoogleSignIn,endpoint,request,workspaceId } from '../../utils/collaboration/client';
import SaveStatus from './SaveStatus';
import ConflictReview from './ConflictReview';
import KanbanBoard from '../kanban/KanbanBoard';
import { useDialogFocus } from '../../hooks/useDialogFocus';
const ExcalidrawEditor=lazy(()=>import('../whiteboard/ExcalidrawEditor'));
export default function ResourceEditor({id,kind,workspace}:{id:string;kind:'board'|'drawing';workspace:Workspace}) {
  const editable=workspace.role!=='viewer',collab=useCollaboration(id,editable,workspace.uid),r=collab.resource,[rename,setRename]=useState(false),[name,setName]=useState(''),[confirmDelete,setConfirmDelete]=useState(false),[driveError,setDriveError]=useState(''),preview=useRef<Blob | undefined>(undefined),dialog=useRef<HTMLDivElement>(null),navigate=useNavigate();
  useDialogFocus(dialog,confirmDelete,()=>setConfirmDelete(false));
  const savePreview=useCallback((blob:Blob)=>{
    if(!editable||blob.size>700000)return;
    const reader=new FileReader();reader.onload=()=>{void request(`/api/drive-checkpoints?workspace=${workspaceId()}`,{action:'preview',resourceId:id,revision:collab.acknowledgedRevision,workspaceId:workspaceId(),preview:reader.result}).catch(()=>{/* Preview failures do not imply a document save failure. */});};reader.readAsDataURL(blob);
  },[editable,id,collab.acknowledgedRevision]);
  const reapply=async(c:Conflict)=>{if(!r||!editable)return;const p={...c.operation.payload};if(c.operation.type==='note.field'){const note=r.data.notes.find(n=>n.id===p.id&&!n.deletedAt);if(!note)return;p.baseVersion=note.versions[p.field as 'title'|'color'];p.generation=note.generation;}else if(c.operation.type==='resource.rename')p.baseName=r.name;else if(c.operation.type==='drawing.change'){p.changes=p.changes.map((change:any)=>{const current=r.data.elements.find(e=>e.id===change.element.id);return {...change,baseVersion:current?.version||0,element:{...change.element,version:(current?.version||0)+1}};});}await collab.submit(c.operation.type,p);await collab.dismiss(c.operation.id);};
  if(!r)return <section className="collab-gate"><h2>Opening {kind==='board'?'board':'drawing'}</h2><p role="status">{collab.error||'Loading the shared resource…'}</p><button onClick={()=>void collab.retry()}>Retry</button></section>;
  if(r.kind!==kind)return <p role="alert">This resource is a different type.</p>;
  return <div className="collab-resource-editor"><div className="collab-toolbar"><div><Link to={kind==='board'?'/kanban':'/whiteboard'} className="collab-back"><ArrowLeft size={16}/>All {kind==='board'?'boards':'drawings'}</Link>{rename?<form onSubmit={e=>{e.preventDefault();void collab.submit('resource.rename',{name,baseName:r.name});setRename(false);}}><input aria-label="Resource name" value={name} onChange={e=>setName(e.target.value)} maxLength={200}/><button>Save name</button><button type="button" onClick={()=>setRename(false)}>Cancel</button></form>:<h1>{r.name}</h1>}</div><div className="collab-actions">{editable&&!r.deleted_at&&<><button onClick={()=>{setName(r.name);setRename(true);}}>Rename</button><button aria-label="Delete resource" onClick={()=>setConfirmDelete(true)}><Trash2 size={16}/></button><button onClick={async()=>{try{const result=await request(`/api/drive-checkpoints?workspace=${workspaceId()}`,{resourceId:r.id,workspaceId:workspaceId()});setDriveError(result.message||'Checkpoint queued.');}catch(e){setDriveError((e as Error).message);}}}><Save size={16}/>Save to Drive</button></>}{kind==='board'&&<><button onClick={()=>download(`${r.name}.json`,JSON.stringify(canonical(r)))}>JSON</button><button onClick={()=>download(`${r.name}.html`,readableBoard(r),'text/html')}>Readable export</button><button onClick={()=>download(`${r.name}.csv`,boardCsv(r),'text/csv')}>CSV</button></>}</div></div>
    <SaveStatus connected={collab.connected} pending={collab.pending} revision={collab.acknowledgedRevision} driveRevision={r.drive_revision} driveStatus={r.drive_status} saved={collab.saved}/>
    {collab.error&&<p className="collab-error" role="alert">{collab.error}<button onClick={()=>void collab.retry()}>Retry pending edits</button>{collab.error.includes('Sign in with Google')&&<button onClick={()=>beginGoogleSignIn()}>Sign in with Google</button>}</p>}{driveError&&<p role="status">{driveError}</p>}
    <ConflictReview conflicts={collab.conflicts} dismiss={id=>void collab.dismiss(id)} reapply={c=>void reapply(c)}/>
    {r.deleted_at?<section className="collab-empty"><h2>This resource is in trash</h2>{editable&&<button onClick={()=>void collab.submit('resource.restore',{})}><RotateCcw size={16}/>Restore resource</button>}</section>:kind==='board'?<KanbanBoard resource={r} editable={editable} submit={collab.submit}/>:<Suspense fallback={<p role="status">Loading the drawing editor…</p>}><ExcalidrawEditor resource={r} editable={editable} submit={collab.submit} presence={collab.presence} updateCursor={collab.updateCursor} onPreview={savePreview}/></Suspense>}
    <p className="collab-participants">{collab.presence.length?`Here with you: ${[...new Set(collab.presence.map(p=>p.name))].join(', ')}`:'You are the only active participant.'}</p>
    {confirmDelete&&<div className="collab-modal-backdrop"><div ref={dialog} className="collab-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-resource-title"><h2 id="delete-resource-title">Move {r.name} to trash?</h2><p>Your team can restore it from Trash. Pending edits from before restoration cannot revive deleted content.</p><button onClick={()=>setConfirmDelete(false)}>Cancel</button><button className="lab-button primary" onClick={()=>{void collab.submit('resource.delete',{});setConfirmDelete(false);}}>Move to trash</button></div></div>}
  </div>;
}
