import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSheetsClient } from './_sheets.js';
import { readPersonnel } from './_personnel.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { sheetId, year } = req.query;
  if (typeof sheetId !== 'string' || !/^[\w-]+$/.test(sheetId) || typeof year !== 'string' || !/^20\d{2}$/.test(year)) {
    return res.status(400).json({ error: 'A valid sheetId and year are required.' });
  }
  try {
    const lists = await readPersonnel(await getSheetsClient(), sheetId, year);
    return res.status(200).json({ lists, syncedAt: Date.now() });
  } catch (error) {
    console.error('Personnel sync failed:', error);
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Unable to read personnel dropdowns.' });
  }
}
