import { useParams } from 'react-router-dom';
import Header from '../components/Layout/Header';
import { useTheme } from '../hooks/useTheme';
import WorkspaceGate from '../components/collaboration/WorkspaceGate';
import ResourceList from '../components/collaboration/ResourceList';
import ResourceEditor from '../components/collaboration/ResourceEditor';
import '../design/collaboration.css';
export default function Whiteboard(){const {id}=useParams(),{theme,setTheme}=useTheme();return <><Header title="Shared drawings" theme={theme} onSetTheme={setTheme}/><div className="collab-page"><WorkspaceGate>{workspace=>id?<ResourceEditor key={`${workspace.uid}:${id}`} id={id} kind="drawing" workspace={workspace}/>:<ResourceList kind="drawing" workspace={workspace}/>}</WorkspaceGate></div></>;}
