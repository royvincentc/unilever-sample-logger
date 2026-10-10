import { createRoot } from 'react-dom/client';
import { BrowserRouter,Routes,Route } from 'react-router-dom';
import { useState } from 'react';
import Kanban from '../../src/pages/Kanban';
import Whiteboard from '../../src/pages/Whiteboard';
import ExcalidrawEditor from '../../src/components/whiteboard/ExcalidrawEditor';
import { convertToExcalidrawElements,CaptureUpdateAction } from '@excalidraw/excalidraw';
import '../../src/index.css';
import '../../src/design/precision-lab.css';
import '../../src/design/collaboration.css';
import type { Resource } from '../../src/types/collaboration';
function Spike(){const [resource,setResource]=useState<Resource>({id:'spike',workspace_id:'fixture',kind:'drawing',name:'History verification',revision:1,generation:1,deleted_at:null,updated_at:new Date().toISOString(),data:{columns:[],notes:[],elements:[],files:{}}});(window as any).spike={setRemote:(elements:any[])=>setResource(r=>({...r,revision:r.revision+1,data:{...r.data,elements}})),make:(elements:any[])=>convertToExcalidrawElements(elements,{regenerateIds:false}),CaptureUpdateAction};return <main className="collab-page"><h1>Editor history verification</h1><ExcalidrawEditor resource={resource} editable submit={async()=>{}} presence={[]} updateCursor={()=>{}} debug={api=>{(window as any).editorAPI=api;}}/></main>;}
createRoot(document.getElementById('root')!).render(<BrowserRouter><main><Routes><Route path="/kanban/:id?" element={<Kanban/>}/><Route path="/whiteboard/:id?" element={<Whiteboard/>}/><Route path="/spike" element={<Spike/>}/><Route path="*" element={<Kanban/>}/></Routes></main></BrowserRouter>);
