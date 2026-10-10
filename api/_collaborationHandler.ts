import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { membership, HttpError, safeFailure } from './_collaborationAuth.js';
import { supabase } from './_supabase.js';
import { applyOperation, initialData, importData, OperationError } from '../src/utils/collaboration/protocol.js';
import type { Resource, Operation } from '../src/types/collaboration.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!['GET','POST'].includes(req.method || '')) throw new HttpError(405, 'Method not allowed.');
    const member = await membership(req, req.method === 'POST' && req.body?.action !== 'presence');
    if (req.method === 'GET') {
      if (req.query.presence) {
        const { data, error } = await supabase!.from('collab_presence').select('uid,session,name,cursor,expires_at').eq('workspace_id', member.workspaceId).eq('resource_id', String(req.query.presence)).gt('expires_at', new Date().toISOString());
        if (error) throw error; return res.json({ presence: data });
      }
      if (req.query.id) {
        const { data, error } = await supabase!.from('collab_resources').select('*').eq('workspace_id', member.workspaceId).eq('id', String(req.query.id)).maybeSingle();
        if (error) throw error; if (!data) throw new HttpError(404, 'Resource not found.');
        return res.json({ resource: data, member });
      }
      const { data, error } = await supabase!.from('collab_resources').select('id,workspace_id,kind,name,revision,generation,deleted_at,updated_at,drive_revision,drive_status').eq('workspace_id', member.workspaceId).order('updated_at', { ascending: false });
      if (error) throw error; return res.json({ resources: data, member });
    }
    const body = req.body;
    if (body?.action === 'presence') {
      const { data: resource } = await supabase!.from('collab_resources').select('id').eq('workspace_id', member.workspaceId).eq('id', body.resourceId).is('deleted_at', null).maybeSingle();
      if (!resource || typeof body.session !== 'string' || body.session.length > 100) throw new HttpError(400, 'Invalid presence.');
      const cursor = body.cursor && Number.isFinite(body.cursor.x) && Number.isFinite(body.cursor.y) ? { x: body.cursor.x, y: body.cursor.y } : null;
      const { error } = await supabase!.from('collab_presence').upsert({ workspace_id: member.workspaceId, resource_id: resource.id, uid: member.uid, session: body.session, name: member.name, cursor, expires_at: new Date(Date.now() + 12000).toISOString() });
      if (error) throw error; return res.json({ ok: true });
    }
    const op: Operation = body?.operation;
    if (!op || typeof op.id !== 'string' || op.id.length > 100 || typeof op.resourceId !== 'string' || !Number.isSafeInteger(op.generation) || !op.payload || typeof op.createdAt !== 'string' || !Number.isFinite(Date.parse(op.createdAt)) || JSON.stringify(op).length > 3_000_000) throw new HttpError(400, 'Invalid operation.');
    const hash = createHash('sha256').update(JSON.stringify(op)).digest('hex');
    const { data: receipt, error: receiptError } = await supabase!.from('collab_receipts').select('hash,result,actor_uid').eq('workspace_id', member.workspaceId).eq('operation_id', op.id).maybeSingle();
    if (receiptError) throw receiptError;
    if (receipt) { if (receipt.hash !== hash || receipt.actor_uid !== member.uid) throw new HttpError(409, 'Operation ID was reused with a different payload.'); const {data:resource,error:readError}=await supabase!.from('collab_resources').select('*').eq('workspace_id',member.workspaceId).eq('id',op.resourceId).single();if(readError)throw readError;return res.json({acknowledgment:receipt.result,resource}); }
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase!.from('collab_resources').select('*').eq('workspace_id', member.workspaceId).eq('id', op.resourceId).maybeSingle();
      if (error) throw error;
      let next: Resource;
      if (op.type === 'resource.create') {
        if (data) throw new HttpError(409, 'Resource already exists.');
        if (!['board','drawing'].includes(op.payload.kind) || typeof op.payload.name !== 'string' || !op.payload.name.trim() || op.payload.name.length > 200) throw new HttpError(400, 'Invalid resource.');
        next = { id: op.resourceId, workspace_id: member.workspaceId, name: op.payload.name.trim(), kind: op.payload.kind, revision: 1, generation: 1, deleted_at: null, updated_at: new Date().toISOString(), data: op.payload.importData ? importData(op.payload.kind,op.payload.importData) : initialData(op.payload.kind) };
      } else { if (!data) throw new HttpError(404, 'Resource not found.'); next = applyOperation(data, { ...op, createdAt: new Date().toISOString() }); }
      const { data: result, error: commitError } = await supabase!.rpc('collab_commit', { p_workspace: member.workspaceId, p_actor: member.uid, p_operation: op.id, p_hash: hash, p_expected: data?.revision ?? 0, p_resource: next });
      if (commitError) { if (commitError.message.includes('revision_conflict')) continue; if (commitError.message.includes('permission_denied')) throw new HttpError(403, 'Workspace access changed.'); throw commitError; }
      const {data:resource,error:readError}=await supabase!.from('collab_resources').select('*').eq('workspace_id',member.workspaceId).eq('id',op.resourceId).single();if(readError)throw readError;
      return res.json({acknowledgment:result,resource});
    }
    throw new HttpError(409, 'The resource is busy. Retry your retained draft.');
  } catch (error) {
    if (error instanceof OperationError) return res.status(error.status).json({ error: error.message });
    const failure = safeFailure(error); if (failure.status === 500) console.error('collaboration failure', error instanceof Error ? error.message : 'unknown'); return res.status(failure.status).json({ error: failure.message });
  }
}
