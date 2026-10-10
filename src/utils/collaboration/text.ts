import * as Y from 'yjs';
import type { Note } from '../../types/collaboration';
import { fromBase64, toBase64 } from './protocol';
export class NoteText {
  doc = new Y.Doc(); text = this.doc.getText('body');
  listeners=new Set<()=>void>();
  private lastState='';
  private send:(update:string)=>void;
  constructor(note:Note, send:(update:string)=>void) {
    this.send=send;
    this.lastState=note.textState;
    if(note.textState) Y.applyUpdate(this.doc,fromBase64(note.textState),'remote');
    this.doc.on('update',(update:Uint8Array,origin:unknown)=>{if(origin==='local')this.send(toBase64(update));for(const listener of this.listeners)listener();});
  }
  merge(note:Note){if(note.textState&&note.textState!==this.lastState){this.lastState=note.textState;Y.applyUpdate(this.doc,fromBase64(note.textState),'remote');}}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  snapshot=()=>this.text.toString();
  replace(value:string){
    const old=this.text.toString();if(old===value)return;
    let start=0;while(start<old.length&&start<value.length&&old[start]===value[start])start++;
    let end=0;while(end<old.length-start&&end<value.length-start&&old[old.length-end-1]===value[value.length-end-1])end++;
    this.doc.transact(()=>{if(old.length-start-end)this.text.delete(start,old.length-start-end);if(value.length-start-end)this.text.insert(start,value.slice(start,value.length-end));},'local');
  }
  destroy(){this.doc.destroy();this.listeners.clear();}
}
