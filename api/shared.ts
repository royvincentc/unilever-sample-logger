import type { VercelRequest, VercelResponse } from '@vercel/node';

// Only this file is a deployed function. Underscore modules remain private
// implementation details; each handler retains its own authorization checks.
const routes = {
  collaboration: () => import('./_collaborationHandler.js'),
  workspace: () => import('./_workspaceHandler.js'),
  'drive-settings': () => import('./_driveSettingsHandler.js'),
  'drive-checkpoints': () => import('./_driveCheckpointsHandler.js'),
  'drive-worker': () => import('./_driveWorkerHandler.js'),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const route = req.query.__route;
  if (typeof route !== 'string' || !Object.hasOwn(routes, route)) {
    return res.status(404).json({ error: 'Unknown collaboration endpoint.' });
  }
  delete req.query.__route;
  const module = await routes[route as keyof typeof routes]();
  return module.default(req, res);
}
