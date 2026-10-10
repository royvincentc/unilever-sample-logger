import { useSyncExternalStore,useRef,useState,useLayoutEffect } from 'react';
import * as Y from 'yjs';
import type { NoteText } from '../../utils/collaboration/text';
export default function CollaborativeBody({model,label,readOnly=false}:{model:NoteText;label:string;readOnly?:boolean}) {
  const value=useSyncExternalStore(model.subscribe,model.snapshot),ref=useRef<HTMLTextAreaElement>(null),composing=useRef(false),[composition,setComposition]=useState<string>(),selection=useRef<{start:Y.RelativePosition;end:Y.RelativePosition} | undefined>(undefined);
  const remember=()=>{const el=ref.current;if(el)selection.current={start:Y.createRelativePositionFromTypeIndex(model.text,el.selectionStart),end:Y.createRelativePositionFromTypeIndex(model.text,el.selectionEnd)};};
  useLayoutEffect(()=>{const el=ref.current;if(!el||document.activeElement!==el||composing.current||!selection.current)return;const start=Y.createAbsolutePositionFromRelativePosition(selection.current.start,model.doc),end=Y.createAbsolutePositionFromRelativePosition(selection.current.end,model.doc);if(start&&end)el.setSelectionRange(start.index,end.index);},[value,model]);
  return <textarea ref={ref} aria-label={label} value={composition??value} readOnly={readOnly} placeholder={readOnly?'No note text':'Write a note…'} onSelect={remember} onCompositionStart={()=>{composing.current=true;setComposition(value);}} onCompositionEnd={e=>{composing.current=false;model.replace(e.currentTarget.value);setComposition(undefined);remember();}} onChange={e=>{if(composing.current)setComposition(e.target.value);else{model.replace(e.target.value);remember();}}} />;
}
