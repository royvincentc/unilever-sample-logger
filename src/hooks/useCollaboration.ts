import { useEffect, useRef, useState, useCallback } from 'react';
import { endpoint, request, RequestError, workspaceId } from '../utils/collaboration/client';
import { readSession, writeSession, sessionKey } from '../utils/collaboration/outbox';
import { applyOperation } from '../utils/collaboration/protocol';
import type { Resource, Operation, Conflict, Presence } from '../types/collaboration';

export function useCollaboration(resourceId: string, canEdit: boolean, userId: string) {
  const [resource,setResource]=useState<Resource>(),[pending,setPending]=useState(0),[conflicts,setConflicts]=useState<Conflict[]>([]),[error,setError]=useState(''),[connected,setConnected]=useState(false),[presence,setPresence]=useState<Presence[]>([]),[saved,setSaved]=useState(false);
  const state=useRef<{snapshot?:Resource; pending:Operation[]; conflicts:Conflict[]}>({pending:[],conflicts:[]});
  const displayed=useRef<Resource | undefined>(undefined);
  const displayedPending=useRef(false);
  const key=useRef(''), busy=useRef(false), session=useRef(crypto.randomUUID()), cursor=useRef<{x:number;y:number} | undefined>(undefined), mounted=useRef(false), writes=useRef(Promise.resolve());
  const paint=useCallback(() => {
    let display=state.current.snapshot;
    if(display&&displayed.current&&!displayedPending.current&&!state.current.pending.length&&display.revision===displayed.current.revision&&display.drive_status===displayed.current.drive_status&&display.drive_revision===displayed.current.drive_revision){
      if(mounted.current){setPending(0);setConflicts([...state.current.conflicts]);}
      return;
    }
    for(const op of state.current.pending) { try { if(display) display=applyOperation(display,op); } catch { /* Keep the draft in outbox for conflict review on send. */ } }
    if(display&&displayed.current){
      const previousNotes=new Map(displayed.current.data.notes.map(n=>[n.id,n]));
      const previousColumns=new Map(displayed.current.data.columns.map(c=>[c.id,c]));
      display={...display,data:{...display.data,notes:display.data.notes.map(n=>{const old=previousNotes.get(n.id);return old&&JSON.stringify(old)===JSON.stringify(n)?old:n;}),columns:display.data.columns.map(c=>{const old=previousColumns.get(c.id);return old&&JSON.stringify(old)===JSON.stringify(c)?old:c;})}};
    }
    displayed.current=display;
    displayedPending.current=state.current.pending.length>0;
    if(mounted.current) { setResource(display); setPending(state.current.pending.length); setConflicts([...state.current.conflicts]); }
  },[]);
  const persist=useCallback(() => { const value=structuredClone(state.current), storageKey=key.current; writes.current=writes.current.then(()=>writeSession(storageKey,value)); return writes.current; },[]);
  const sync=useCallback(async () => {
    if(busy.current || !key.current || !mounted.current) return;
    busy.current=true;
    try {
      // Fetch first so stale operations are reviewed against a current snapshot.
      const result=await request(endpoint(`&id=${encodeURIComponent(resourceId)}`));
      if(!mounted.current) return;
      state.current.snapshot=result.resource;
      setConnected(true); setError('');
      while(state.current.pending.length && canEdit) {
        const op=state.current.pending[0];
        try { const ack=await request(endpoint(),{operation:op,workspaceId:workspaceId()}); state.current.snapshot=ack.resource; state.current.pending.shift(); setSaved(true); }
        catch(e) { if(e instanceof RequestError && [400,403,404,409].includes(e.status)) { state.current.pending.shift(); state.current.conflicts.push({operation:op,message:e.message,current:state.current.snapshot}); if(e.status===403) { setConnected(false); setError(e.message); } } else throw e; }
        await persist(); paint();
      }
      await persist(); paint();
      if(!state.current.snapshot?.deleted_at) {
        await request(endpoint(),{action:'presence',resourceId,session:session.current,cursor:cursor.current,workspaceId:workspaceId()});
        const people=await request(endpoint(`&presence=${encodeURIComponent(resourceId)}`));
        if(mounted.current) setPresence(people.presence.filter((p:Presence)=>p.session!==session.current));
      }
    } catch(e) { if(mounted.current) { setConnected(false); setError((e as Error).message); } paint(); }
    finally { busy.current=false; }
  },[resourceId,canEdit,paint,persist]);
  useEffect(()=>{
    mounted.current=true; let canceled=false;
    key.current=sessionKey(userId,workspaceId(),resourceId);
    readSession(key.current).then(stored=>{if(!canceled){state.current=stored;paint();void sync();}}).catch(e=>setError(e.message));
    const timer=setInterval(()=>void sync(),1500); const reconnect=()=>void sync(); window.addEventListener('online',reconnect);
    return()=>{canceled=true;mounted.current=false;clearInterval(timer);window.removeEventListener('online',reconnect);};
  },[resourceId,userId,paint,sync]);
  useEffect(()=>{if(!saved)return;const timer=setTimeout(()=>setSaved(false),1000);return()=>clearTimeout(timer);},[saved]);
  const submit=useCallback(async(type:string,payload:Record<string,any>)=>{
    if(!canEdit || !state.current.snapshot) return;
    const op:Operation={id:crypto.randomUUID(),resourceId,generation:state.current.snapshot.generation,type,payload,createdAt:new Date().toISOString()};
    state.current.pending.push(op);paint();
    try {await persist();void sync();} catch(e) {setError(`Local draft could not be stored: ${(e as Error).message}`);}
    return op;
  },[canEdit,resourceId,paint,persist,sync]);
  const dismiss=async(id:string)=>{state.current.conflicts=state.current.conflicts.filter(c=>c.operation.id!==id);await persist();paint();};
  return {resource,pending,conflicts,error,connected,presence,saved,acknowledgedRevision:state.current.snapshot?.revision,submit,retry:sync,dismiss,updateCursor:(point:{x:number;y:number})=>{cursor.current=point;}};
}
