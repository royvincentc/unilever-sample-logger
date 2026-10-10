import { useEffect, useState } from 'react';
import { auth } from '../utils/firebase';
import { request, workspaceId } from '../utils/collaboration/client';
import type { Workspace } from '../types/collaboration';
export function useWorkspace() {
  const [workspace,setWorkspace]=useState<Workspace>();
  const [error,setError]=useState(''), [loading,setLoading]=useState(true);
  useEffect(() => auth.onAuthStateChanged(async user => {
    setWorkspace(undefined); setLoading(true);
    try { if (!user || user.isAnonymous) throw new Error('Sign in with Google to use shared boards and drawings.'); const result=await request(`/api/workspace?workspace=${encodeURIComponent(workspaceId())}`); setWorkspace(result.workspace); setError(''); }
    catch(e) { setError((e as Error).message); } finally { setLoading(false); }
  }),[]);
  return {workspace,error,loading};
}
