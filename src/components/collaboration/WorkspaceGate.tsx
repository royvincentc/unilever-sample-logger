import { useState, type ReactNode } from 'react';
import { useWorkspace } from '../../hooks/useWorkspace';
import type { Workspace } from '../../types/collaboration';
import Button from '../ui/Button';
import { beginGoogleSignIn } from '../../utils/collaboration/client';
export default function WorkspaceGate({children}:{children:(workspace:Workspace)=>ReactNode}) {
  const {workspace,error,loading,status,retry}=useWorkspace();
  const [signingIn,setSigningIn]=useState(false);
  if(workspace)return children(workspace);
  const setupRequired=status===503;
  return <section className="collab-gate" aria-busy={loading || signingIn}>
    <h2 className="text-balance">{loading?'Opening your workspace':setupRequired?'Shared workspace needs setup':'Shared workspace access'}</h2>
    <p className="text-pretty" role="status">{loading?'Checking your sign-in…':error}</p>
    {!loading && <>
      {setupRequired ? <>
        <Button onClick={retry}>Check again</Button>
        <p className="text-pretty">The server needs Google OAuth and workspace configuration before users can connect.</p>
      </> : <>
        <Button loading={signingIn} onClick={()=>{setSigningIn(true);beginGoogleSignIn();}}>{status===403?'Sign in with another Google account':'Sign in with Google'}</Button>
        {status!==401 && <Button variant="secondary" disabled={signingIn} onClick={retry}>Check access again</Button>}
        <p className="text-pretty">Any verified Google account can join and edit shared boards after signing in.</p>
      </>}
    </>}
  </section>;
}
