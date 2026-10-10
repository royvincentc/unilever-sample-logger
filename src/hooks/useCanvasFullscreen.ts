import { useCallback,useEffect,useRef,useState } from 'react';
export function useCanvasFullscreen() {
  const frame=useRef<HTMLDivElement>(null),[fullscreen,setFullscreen]=useState(false),previous=useRef<HTMLElement|null>(null);
  const exit=useCallback(()=>{setFullscreen(false);if(document.fullscreenElement===frame.current)void document.exitFullscreen().catch(()=>{});},[]);
  const enter=useCallback(()=>{previous.current=document.activeElement as HTMLElement;setFullscreen(true);void frame.current?.requestFullscreen?.().catch(()=>{/* CSS fullscreen works when browser fullscreen is unavailable. */});},[]);
  useEffect(()=>{const changed=()=>{if(!document.fullscreenElement)setFullscreen(false);};document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);
  useEffect(()=>{
    if(!fullscreen)return;
    const root=frame.current!;const inertNodes:HTMLElement[]=[];
    let node:HTMLElement|null=root;
    while(node?.parentElement){for(const sibling of Array.from(node.parentElement.children)){if(sibling!==node&&sibling instanceof HTMLElement&&!sibling.inert){sibling.inert=true;inertNodes.push(sibling);}}node=node.parentElement;}
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    root.querySelector<HTMLButtonElement>('[data-exit-fullscreen]')?.focus();
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();exit();}if(event.key==='Tab'){const controls=Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(e=>e.getClientRects().length);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
    document.addEventListener('keydown',key,true);
    return()=>{for(const n of inertNodes)n.inert=false;document.body.style.overflow=overflow;document.removeEventListener('keydown',key,true);if(previous.current?.isConnected)previous.current.focus();};
  },[fullscreen,exit]);
  return {frame,fullscreen,enter,exit};
}
