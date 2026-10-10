export type Role = 'admin' | 'editor' | 'viewer';
export type NoteColor = 'yellow' | 'blue' | 'green' | 'pink';
export interface Column { id: string; title: string; deletedAt?: string; generation: number }
export interface Note { id: string; title: string; color: NoteColor; columnId: string; body: string; textState: string; versions: { title: number; color: number }; generation: number; deletedAt?: string }
export interface DrawingElement { id: string; version: number; versionNonce: number; isDeleted: boolean; [key: string]: unknown }
export interface BinaryFile { id: string; dataURL: string; mimeType: string; created: number; [key: string]: unknown }
export interface ResourceData { columns: Column[]; notes: Note[]; elements: DrawingElement[]; files: Record<string, BinaryFile> }
export interface Resource { id: string; workspace_id: string; kind: 'board' | 'drawing'; name: string; revision: number; generation: number; deleted_at: string | null; data: ResourceData; updated_at: string; drive_revision?: number; drive_status?: string }
export interface Workspace { id: string; name: string; role: Role; uid: string }
export interface Operation { id: string; resourceId: string; generation: number; type: string; payload: Record<string, any>; createdAt: string }
export interface Presence { uid: string; session: string; name: string; cursor?: { x: number; y: number }; expires_at: string }
export interface Conflict { operation: Operation; message: string; current?: Resource }
export const emptyData = (): ResourceData => ({ columns: [], notes: [], elements: [], files: {} });
