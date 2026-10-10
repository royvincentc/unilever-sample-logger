import { useParams } from 'react-router-dom';
import Header from '../components/Layout/Header';
import { useTheme } from '../hooks/useTheme';
import WorkspaceGate from '../components/collaboration/WorkspaceGate';
import ResourceList from '../components/collaboration/ResourceList';
import ResourceEditor from '../components/collaboration/ResourceEditor';
import '../design/collaboration.css';
export default function Kanban(){const {id}=useParams(),{theme,setTheme}=useTheme();return <><Header title="Shared boards" theme={theme} onSetTheme={setTheme}/><div className="collab-page"><WorkspaceGate>{workspace=>id?<ResourceEditor key={`${workspace.uid}:${id}`} id={id} kind="board" workspace={workspace}/>:<ResourceList kind="board" workspace={workspace}/>}</WorkspaceGate></div></>;}
