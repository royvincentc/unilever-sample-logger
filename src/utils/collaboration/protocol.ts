import * as Y from 'yjs';
import type { Operation, Resource, ResourceData, Note, DrawingElement, Column } from '../../types/collaboration';

export class OperationError extends Error { status: number; constructor(message: string, status = 409) { super(message); this.status=status; } }
export function fromBase64(value: string): Uint8Array { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
export function toBase64(value: Uint8Array): string { let s = ''; for (const b of value) s += String.fromCharCode(b); return btoa(s); }
export function textDocument(note?: Pick<Note, 'textState'>): Y.Doc { const doc = new Y.Doc(); if (note?.textState) Y.applyUpdate(doc, fromBase64(note.textState)); return doc; }
export function textSnapshot(doc: Y.Doc) { return { textState: toBase64(Y.encodeStateAsUpdate(doc)), body: doc.getText('body').toString() }; }
export function initialData(kind: Resource['kind']): ResourceData {
  return { columns: kind === 'board' ? ['To do', 'In progress', 'Done'].map(title => ({ id: crypto.randomUUID(), title, generation: 1 })) : [], notes: [], elements: [], files: {} };
}
function text(value: unknown, max = 200): string { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new OperationError('Enter a valid value.', 400); return value.trim(); }
export function validateFiles(files: Record<string, any>) {
  if (!files || typeof files !== 'object' || Array.isArray(files) || Object.keys(files).length > 100) throw new OperationError('Invalid image files.', 400);
  for (const [id, file] of Object.entries(files)) {
    if (file.id !== id || !['image/png','image/jpeg','image/webp','image/gif'].includes(file.mimeType) || typeof file.dataURL !== 'string' || !file.dataURL.startsWith(`data:${file.mimeType};base64,`) || file.dataURL.length > 7_000_000) throw new OperationError('Only bounded PNG, JPEG, WebP and GIF images are supported.', 400);
  }
}
export function validateElements(elements: any[]) {
  if (!Array.isArray(elements) || elements.length > 10000) throw new OperationError('Too many drawing elements.', 400);
  const ids = new Set<string>();
  for (const element of elements) {
    if (!element || typeof element.id !== 'string' || element.id.length > 200 || ids.has(element.id) || !Number.isSafeInteger(element.version) || element.version < 1 || !Number.isFinite(element.versionNonce)) throw new OperationError('Invalid drawing element.', 400);
    ids.add(element.id);
    if (element.link && !/^(https?:|mailto:)/i.test(element.link)) throw new OperationError('Unsupported drawing link.', 400);
    for (const key of ['x','y','width','height']) if (!Number.isFinite(element[key]) || Math.abs(element[key]) > 1e8) throw new OperationError('Invalid element dimensions.', 400);
  }
}
export function importData(kind:Resource['kind'], input:any):ResourceData {
  if(!input || JSON.stringify(input).length>3_000_000)throw new OperationError('Snapshot exceeds the 3 MB resource limit.',400);
  if(kind==='drawing') {validateElements(input.elements);validateFiles(input.files||{});for(const e of input.elements)if(!e.isDeleted&&e.type==='image'&&!input.files?.[e.fileId])throw new OperationError('Snapshot is missing an image.',400);return {columns:[],notes:[],elements:input.elements,files:input.files||{}};}
  if(!Array.isArray(input.columns)||input.columns.length>100||!Array.isArray(input.notes)||input.notes.length>10000)throw new OperationError('Invalid board snapshot.',400);
  const columns=input.columns.map((c:any)=>({id:text(c.id),title:text(c.title),generation:1,...(c.deletedAt?{deletedAt:String(c.deletedAt)}:{})}));
  if(new Set(columns.map((c:Column)=>c.id)).size!==columns.length)throw new OperationError('Duplicate column IDs.',400);
  const notes=input.notes.map((n:any)=>{if(!columns.some((c:Column)=>c.id===n.columnId)||!['yellow','blue','green','pink'].includes(n.color)||typeof n.body!=='string'||n.body.length>100000)throw new OperationError('Invalid note snapshot.',400);const doc=new Y.Doc();try{doc.getText('body').insert(0,n.body);return {id:text(n.id),title:text(n.title),color:n.color,columnId:n.columnId,...textSnapshot(doc),versions:{title:0,color:0},generation:1,...(n.deletedAt?{deletedAt:String(n.deletedAt)}:{})};}finally{doc.destroy();}});
  if(new Set(notes.map((n:Note)=>n.id)).size!==notes.length)throw new OperationError('Duplicate note IDs.',400);
  return {columns,notes,elements:[],files:{}};
}
export function applyOperation(resource: Resource, op: Operation): Resource {
  if (op.generation !== resource.generation) throw new OperationError('This resource changed generation. Review your pending draft.');
  if (resource.deleted_at && op.type !== 'resource.restore') throw new OperationError('This resource is in trash. Restore it before editing.');
  const next = structuredClone(resource), p = op.payload, data = next.data;
  const boardOnly = op.type.startsWith('note.') || op.type.startsWith('column.');
  if (boardOnly && resource.kind !== 'board' || op.type.startsWith('drawing.') && resource.kind !== 'drawing') throw new OperationError('Operation does not match the resource.', 400);
  const column = (id: string) => { const c = data.columns.find(c => c.id === id && !c.deletedAt); if (!c) throw new OperationError('Column no longer exists.'); return c; };
  const note = (allowDeleted = false) => { const n = data.notes.find(n => n.id === p.id); if (!n || n.deletedAt && !allowDeleted || n.generation !== p.generation) throw new OperationError('Note changed or was deleted. Your draft is retained.'); return n; };
  switch (op.type) {
    case 'resource.rename': if (p.baseName !== next.name) throw new OperationError('Name changed in another session.'); next.name = text(p.name); break;
    case 'resource.delete': next.deleted_at = op.createdAt; break;
    case 'resource.restore': if (!next.deleted_at) throw new OperationError('Resource is already restored.'); next.deleted_at = null; next.generation++; break;
    case 'column.create': if (data.columns.some(c => c.id === p.id)) throw new OperationError('Column ID already exists.'); data.columns.push({ id: text(p.id), title: text(p.title), generation: 1 }); break;
    case 'column.rename': { const c = column(p.id); if (c.title !== p.baseTitle) throw new OperationError('Column name changed.'); c.title = text(p.title); break; }
    case 'column.move': { const c = column(p.id); data.columns = data.columns.filter(x => x.id !== c.id); const index = p.beforeId ? data.columns.findIndex(x => x.id === p.beforeId && !x.deletedAt) : data.columns.length; if (index < 0) throw new OperationError('Destination column changed.'); data.columns.splice(index, 0, c); break; }
    case 'column.delete': { const c = column(p.id); const affected = data.notes.filter(n => n.columnId === c.id && !n.deletedAt); if (affected.length && p.action !== 'trash' && p.action !== 'move') throw new OperationError('Choose how to handle the notes.', 400); if (p.action === 'move') { if (p.targetId === c.id) throw new OperationError('Choose another column.', 400); column(p.targetId); } for (const n of affected) { if (p.action === 'move') n.columnId = p.targetId; else n.deletedAt = op.createdAt; } c.deletedAt = op.createdAt; break; }
    case 'note.create': { column(p.columnId); if (data.notes.some(n => n.id === p.id)) throw new OperationError('Note ID already exists.'); data.notes.push({ id: text(p.id), title: text(p.title || 'New note'), color: 'yellow', columnId: p.columnId, body: '', textState: '', versions: { title: 0, color: 0 }, generation: 1 }); break; }
    case 'note.text': { const n = note(); if (typeof p.update !== 'string' || p.update.length > 1_000_000) throw new OperationError('Text update is too large.', 400); const doc = textDocument(n); try { Y.applyUpdate(doc, fromBase64(p.update)); Object.assign(n, textSnapshot(doc)); if (n.body.length > 100000) throw new OperationError('Note body is too long.', 400); } finally { doc.destroy(); } break; }
    case 'note.field': { const n = note(); if (!['title','color'].includes(p.field)) throw new OperationError('Invalid note field.', 400); const field = p.field as 'title' | 'color'; if (n.versions[field] !== p.baseVersion) throw new OperationError(`${field} changed in another session. Review your draft.`); if (field === 'title') n.title = text(p.value); else { if (!['yellow','blue','green','pink'].includes(p.value)) throw new OperationError('Invalid note color.', 400); n.color = p.value; } n.versions[field]++; break; }
    case 'note.move': { const n = note(); column(p.columnId); n.columnId = p.columnId; data.notes = data.notes.filter(x => x.id !== n.id); let index = p.beforeId ? data.notes.findIndex(x => x.id === p.beforeId && !x.deletedAt && x.columnId === p.columnId) : data.notes.length; if (index < 0) throw new OperationError('Destination note changed.'); data.notes.splice(index, 0, n); break; }
    case 'note.delete': note().deletedAt = op.createdAt; break;
    case 'note.restore': { const n = note(true); if (!n.deletedAt) throw new OperationError('Note already restored.'); column(p.columnId || n.columnId); n.columnId = p.columnId || n.columnId; delete n.deletedAt; n.generation++; break; }
    case 'drawing.change': {
      validateFiles(p.files || {}); Object.assign(data.files, p.files || {});
      validateElements((p.changes || []).map((change: any) => change.element));
      const existing = new Map(data.elements.map(e => [e.id, e]));
      for (const change of p.changes || []) {
        const e = change.element as DrawingElement, current = existing.get(e.id);
        // Whole-element conflicts must be reviewed, rather than undoing somebody else's work.
        if ((current?.version ?? 0) !== change.baseVersion) throw new OperationError('A drawing element changed concurrently. Your draft was retained.');
        if (current?.isDeleted && !e.isDeleted && !change.restore) throw new OperationError('A deleted element requires an explicit current-version restore.');
        if (current && e.version <= current.version) throw new OperationError('Stale drawing version.');
        existing.set(e.id, e);
      }
      data.elements = [...existing.values()];
      for (const e of data.elements) if (!e.isDeleted && e.type === 'image' && !data.files[String(e.fileId)]) throw new OperationError('Image upload must be committed with its element.', 400);
      break;
    }
    default: throw new OperationError('Unsupported operation.', 400);
  }
  if(JSON.stringify(data).length>3_000_000)throw new OperationError('This resource exceeds the 3 MB limit. Export it and split into smaller resources.',400);
  next.revision++; next.updated_at = op.createdAt;
  return next;
}
