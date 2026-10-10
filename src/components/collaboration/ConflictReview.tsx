import type { Conflict } from '../../types/collaboration';
export default function ConflictReview({conflicts,dismiss,reapply}:{conflicts:Conflict[];dismiss:(id:string)=>void;reapply:(conflict:Conflict)=>void}) {
  if(!conflicts.length)return null;
  return <section className="collab-conflicts" aria-label="Drafts to review"><h2>Review your drafts</h2>{conflicts.map(c=><div key={c.operation.id}><p>{c.message}</p><pre>{JSON.stringify(c.operation.payload,null,2).slice(0,3000)}</pre><button onClick={()=>reapply(c)}>Reapply to current version</button><button onClick={()=>dismiss(c.operation.id)}>Keep server version</button><button onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(c.operation)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='retained-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Download draft</button></div>)}</section>;
}
