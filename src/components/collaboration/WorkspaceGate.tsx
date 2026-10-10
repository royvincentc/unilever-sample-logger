import type { ReactNode } from 'react';
import { signInWithGooglePopup } from '../../utils/auth';
import { useWorkspace } from '../../hooks/useWorkspace';
import type { Workspace } from '../../types/collaboration';
import Button from '../ui/Button';
export default function WorkspaceGate({children}:{children:(workspace:Workspace)=>ReactNode}) {
  const {workspace,error,loading}=useWorkspace();
  if(workspace)return children(workspace);
  return <section className="collab-gate"><h2>{loading?'Opening your workspace':'Shared workspace access'}</h2><p role="status">{loading?'Checking your membership…':error}</p>{!loading&&<><Button onClick={()=>void signInWithGooglePopup()}>Sign in with Google</Button><p>Ask your workspace administrator to add your Google account if access is denied.</p></>}</section>;
}
