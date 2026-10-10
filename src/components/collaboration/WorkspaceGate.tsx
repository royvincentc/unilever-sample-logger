import { useState, type ReactNode } from 'react';
import { signInWithGooglePopup } from '../../utils/auth';
import { useWorkspace } from '../../hooks/useWorkspace';
import type { Workspace } from '../../types/collaboration';
import Button from '../ui/Button';
export default function WorkspaceGate({children}:{children:(workspace:Workspace)=>ReactNode}) {
  const {workspace,error,loading,status,signedIn,retry}=useWorkspace();
  const [signingIn,setSigningIn]=useState(false), [signInError,setSignInError]=useState('');
  const signIn=async()=>{
    setSigningIn(true); setSignInError('');
    try {
      const result=await signInWithGooglePopup();
      if(result.success) retry();
      else setSignInError(result.error || 'Google sign-in failed. Please try again.');
    } finally { setSigningIn(false); }
  };
  if(workspace)return children(workspace);
  const setupRequired=status===503;
  return <section className="collab-gate" aria-busy={loading || signingIn}>
    <h2 className="text-balance">{loading?'Opening your workspace':setupRequired?'Shared workspace needs setup':'Shared workspace access'}</h2>
    <p className="text-pretty" role="status">{loading?'Checking your membership…':error}</p>
    {signInError && <p role="alert">{signInError}</p>}
    {!loading && <>
      {setupRequired ? <>
        <Button onClick={retry}>Check again</Button>
        <p className="text-pretty">Google sign-in cannot fix a server setup problem. Your administrator needs to finish configuring this workspace.</p>
      </> : <>
        <Button loading={signingIn} onClick={()=>void signIn()}>{signedIn && status===403?'Use another Google account':'Sign in with Google'}</Button>
        {signedIn && status!==401 && <Button variant="secondary" disabled={signingIn} onClick={retry}>Check access again</Button>}
        <p className="text-pretty">Ask your workspace administrator to add your Google account if access is denied.</p>
      </>}
    </>}
  </section>;
}
