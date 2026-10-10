import { useEffect, useState } from 'react';
import { request, RequestError, workspaceId } from '../utils/collaboration/client';
import type { Workspace } from '../types/collaboration';
export function useWorkspace() {
  const [workspace,setWorkspace]=useState<Workspace>();
  const [error,setError]=useState(''), [loading,setLoading]=useState(true);
  const [status,setStatus]=useState<number>();
  const [attempt,setAttempt]=useState(0);
  useEffect(() => {
    let active=true;
    setWorkspace(undefined); setLoading(true);
    void request(`/api/workspace?workspace=${encodeURIComponent(workspaceId())}`).then(result=>{
      if(active) { setWorkspace(result.workspace); setError(''); setStatus(undefined); }
    }).catch(e=>{
      if(active) { setError((e as Error).message); setStatus(e instanceof RequestError ? e.status : undefined); }
    }).finally(()=>{ if(active) setLoading(false); });
    return () => { active=false; };
  },[attempt]);
  return {workspace,error,loading,status,retry:()=>setAttempt(value=>value+1)};
}
