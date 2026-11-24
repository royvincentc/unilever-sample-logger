import type { VercelRequest, VercelResponse } from '@vercel/node';
import { defaultSampleCatalog, validateSampleCatalog } from '../src/data/sampleCatalog.js';
import { HttpError, membership, safeFailure } from './_collaborationAuth.js';
import { supabase } from './_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    const write = req.method === 'POST';
    const member = await membership(req, write, write);
    const table = supabase!.from('collab_sample_catalogs');

    if (!write) {
      const { data, error } = await table.select('revision,catalog').eq('workspace_id', member.workspaceId).maybeSingle();
      if (error) throw error;
      return res.json(data ?? { revision: 0, catalog: defaultSampleCatalog });
    }

    const { catalog, revision } = req.body ?? {};
    if (!Number.isInteger(revision) || revision < 0 || revision >= 2147483647) {
      throw new HttpError(400, 'Reload the sample catalog before saving.');
    }
    if (JSON.stringify(catalog)?.length > 250_000) throw new HttpError(400, 'The sample catalog is too large.');
    const invalid = validateSampleCatalog(catalog);
    if (invalid) throw new HttpError(400, invalid);

    const update = { catalog, revision: revision + 1, updated_by: member.uid };
    const { data, error } = revision === 0
      ? await table.insert({ ...update, workspace_id: member.workspaceId }).select('revision').single()
      : await table.update(update).eq('workspace_id', member.workspaceId).eq('revision', revision).select('revision').maybeSingle();
    if (error && error.code !== '23505') throw error;
    if (!data) throw new HttpError(409, 'Another admin saved a newer catalog. Reload it before saving again.');
    return res.json({ revision: data.revision });
  } catch (error) {
    const failure = safeFailure(error);
    return res.status(failure.status).json({ error: failure.message });
  }
}
