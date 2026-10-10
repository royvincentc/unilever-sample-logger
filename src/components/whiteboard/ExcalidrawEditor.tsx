import { useEffect,useRef,useState,useCallback } from 'react';
import { Excalidraw, MainMenu, CaptureUpdateAction, reconcileElements, restoreElements, exportToBlob, exportToSvg } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import '@excalidraw/excalidraw/index.css';
import { Maximize2,Minimize2,Scan } from 'lucide-react';
import type { Resource,Presence } from '../../types/collaboration';
import { canonical,download } from '../../utils/collaboration/export';
import { useCanvasFullscreen } from '../../hooks/useCanvasFullscreen';
(window as any).EXCALIDRAW_ASSET_PATH='/excalidraw/';
export default function ExcalidrawEditor({resource,editable,submit,presence,updateCursor,onPreview,debug}:{resource:Resource;editable:boolean;submit:(type:string,payload:Record<string,any>)=>Promise<unknown>;presence:Presence[];updateCursor:(point:{x:number;y:number})=>void;onPreview?:(blob:Blob)=>void;debug?:(api:ExcalidrawImperativeAPI)=>void}) {
  const [api,setApi]=useState<ExcalidrawImperativeAPI>(),{frame,fullscreen,enter,exit}=useCanvasFullscreen(),gesture=useRef(false),composing=useRef(false),pending=useRef<any>(undefined),timer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined),applying=useRef(false),latest=useRef(resource),sent=useRef(new Map<string,string>()),lastPreview=useRef(0);
  latest.current=resource;
  const signature=(element:any)=>JSON.stringify(element);
  const publish=useCallback(()=>{
    if(!pending.current||!editable)return;const {elements,files}=pending.current;pending.current=undefined;
    const base=new Map(latest.current.data.elements.map(e=>[e.id,e])),changes=[];
    for(const e of elements){const old=base.get(e.id),hash=signature(e);if(signature(old)!==hash&&sent.current.get(e.id)!==hash){changes.push({element:e,baseVersion:old?.version||0,restore:!!old?.isDeleted&&!e.isDeleted});sent.current.set(e.id,hash);}}
    const addedFiles=Object.fromEntries(Object.entries(files).filter(([id])=>!latest.current.data.files[id]));
    if(changes.length||Object.keys(addedFiles).length)void submit('drawing.change',{changes,files:addedFiles});
  },[editable,submit]);
  const reconcile=useCallback(()=>{
    if(!api||gesture.current||composing.current||pending.current||api.getAppState().editingTextElement)return;
    const remote=restoreElements(latest.current.data.elements as any,null),local=api.getSceneElementsIncludingDeleted();
    if(signature(remote)===signature(local))return;
    applying.current=true;
    api.addFiles(Object.values(latest.current.data.files) as any);
    const elements=reconcileElements(local,remote as any,api.getAppState());
    api.updateScene({elements,captureUpdate:CaptureUpdateAction.NEVER});
    applying.current=false;
  },[api]);
  useEffect(()=>{reconcile();},[resource.revision,reconcile]);
  useEffect(()=>{if(api){api.addFiles(Object.values(resource.data.files) as any);debug?.(api);}},[api]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);publish();},[publish]);
  useEffect(()=>{
    if(!api)return;
    const collaborators=new Map(presence.map(p=>[p.session,{id:p.uid,username:p.name,pointer:p.cursor?{...p.cursor,tool:'pointer' as const}:undefined,color:{background:'#245bd6',stroke:'#245bd6'}}]));api.updateScene({collaborators:collaborators as any,captureUpdate:CaptureUpdateAction.NEVER});
  },[presence,api]);
  useEffect(()=>{if(!api||!onPreview)return;let idle:ReturnType<typeof setTimeout>;const generate=()=>{if(gesture.current||pending.current||composing.current){idle=setTimeout(generate,1500);return;}lastPreview.current=Date.now();void exportToBlob({elements:api.getSceneElements(),appState:api.getAppState(),files:api.getFiles(),mimeType:'image/png',maxWidthOrHeight:768}).then((blob:Blob)=>onPreview(blob)).catch(()=>{});};idle=setTimeout(generate,Math.max(1500,5000-(Date.now()-lastPreview.current)));return()=>clearTimeout(idle);},[resource.revision,api,onPreview]);
  const exportImage=async(type:'png'|'svg')=>{if(!api)return;try{if(type==='png')download(`${resource.name}.png`,await exportToBlob({elements:api.getSceneElements(),appState:api.getAppState(),files:api.getFiles(),mimeType:'image/png'}));else download(`${resource.name}.svg`,(await exportToSvg({elements:api.getSceneElements(),appState:api.getAppState(),files:api.getFiles()})).outerHTML,'image/svg+xml');}catch(e){api.setToast({message:(e as Error).message});}};
  return <div ref={frame} className={`canvas-frame ${fullscreen?'canvas-fullscreen':''}`} onPointerDownCapture={()=>{gesture.current=true;}} onPointerUpCapture={()=>{gesture.current=false;publish();setTimeout(reconcile,0);}} onPointerCancelCapture={()=>{gesture.current=false;publish();setTimeout(reconcile,0);}} onCompositionStartCapture={()=>{composing.current=true;}} onCompositionEndCapture={()=>{composing.current=false;publish();setTimeout(reconcile,0);}}>
    <div className="canvas-actions"><button onClick={()=>api?.scrollToContent(undefined,{fitToContent:true,viewportZoomFactor:0.75,animate:!window.matchMedia('(prefers-reduced-motion: reduce)').matches})}><Scan size={16}/>Fit drawing</button><button onClick={()=>download(`${resource.name}.excalidraw`,JSON.stringify(canonical({...resource,data:{...resource.data,elements:api?.getSceneElementsIncludingDeleted() as any||resource.data.elements,files:api?.getFiles() as any||resource.data.files}})))}>Export .excalidraw</button><button onClick={()=>void exportImage('png')}>PNG</button><button onClick={()=>void exportImage('svg')}>SVG</button>{fullscreen?<button data-exit-fullscreen onClick={exit}><Minimize2 size={16}/>Exit fullscreen</button>:<button onClick={enter}><Maximize2 size={16}/>Fullscreen</button>}</div>
    <div className="canvas-editor"><Excalidraw excalidrawAPI={setApi} initialData={{elements:restoreElements(resource.data.elements as any,null),files:resource.data.files as any,appState:{viewBackgroundColor:'#ffffff'}}} viewModeEnabled={!editable} isCollaborating={presence.length>0} onPointerUpdate={({pointer})=>updateCursor(pointer)} onChange={(elements:readonly OrderedExcalidrawElement[],_state:AppState,files:BinaryFiles)=>{if(applying.current||!editable)return;pending.current={elements,files};if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{publish();reconcile();},250);}}><MainMenu><MainMenu.DefaultItems.ToggleTheme/><MainMenu.DefaultItems.ChangeCanvasBackground/><MainMenu.DefaultItems.Help/></MainMenu></Excalidraw></div>
  </div>;
}
