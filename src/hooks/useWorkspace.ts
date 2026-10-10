import { useEffect, useState } from 'react';
import { auth } from '../utils/firebase';
import { request, RequestError, workspaceId } from '../utils/collaboration/client';
import type { Workspace } from '../types/collaboration';
export function useWorkspace() {
  const [workspace,setWorkspace]=useState<Workspace>();
  const [error,setError]=useState(''), [loading,setLoading]=useState(true);
  const [status,setStatus]=useState<number>(), [signedIn,setSignedIn]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(() => {
    let active=true, generation=0;
    const unsubscribe=auth.onAuthStateChanged(async user => {
    const current=++generation;
    setSignedIn(!!user && !user.isAnonymous);
    setWorkspace(undefined); setLoading(true);
    try {
      if (!user || user.isAnonymous) throw new RequestError(401,'Sign in with Google to use shared boards and drawings.');
      const result=await request(`/api/workspace?workspace=${encodeURIComponent(workspaceId())}`);
      if(active && current===generation) { setWorkspace(result.workspace); setError(''); setStatus(undefined); }
    } catch(e) {
      if(active && current===generation) { setError((e as Error).message); setStatus(e instanceof RequestError ? e.status : undefined); }
    } finally { if(active && current===generation) setLoading(false); }
    });
    return () => { active=false; unsubscribe(); };
  },[attempt]);
  return {workspace,error,loading,status,signedIn,retry:()=>setAttempt(value=>value+1)};
}
