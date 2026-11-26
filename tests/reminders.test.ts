import test from 'node:test';
import assert from 'node:assert/strict';
import { dueReminders } from '../src/utils/reminders.ts';
import type { HistoryEntry } from '../src/types/index.ts';

const entry = (over: Partial<HistoryEntry>): HistoryEntry => ({
  id: 'a', sampleType: 'WATER', controlNumber: 'W26-1', sampleName: 'Tank 2', dateSampled: '2026-11-19',
  status: 'ONGOING', submittedAt: '2026-11-19T01:00:00.000Z', submittedBy: 'Roy', ...over,
} as HistoryEntry);
const now = new Date(2026, 10, 26, 7, 30); // 7:30am local, before UTC midnight rolls over in Manila

test('water readings fall due on day 2, 7 and 14, today before tomorrow', () => {
  const list = dueReminders([
    entry({ id: 'tomorrow', dateAnalyzed: '2026-11-13' }), // day 14 tomorrow
    entry({ id: 'today', dateAnalyzed: '2026-11-19' }), // day 7 today
    entry({ id: 'none', dateAnalyzed: '2026-11-21' }), // day 7 is the 28th
  ], 'Roy', now);
  assert.deepEqual(list.map(r => [r.entry.id, r.reading, r.inDays]), [['today', '7th day reading', 0], ['tomorrow', '14th day reading', 1]]);
});

test('raw materials, other analysts and closed records', () => {
  const list = dueReminders([
    entry({ id: 'liquid', sampleType: 'RawMats', sampleName: 'Liquid detergent lot A', dateAnalyzed: '2026-11-23' }),
    entry({ id: 'fabcon', sampleType: 'RawMats', sampleName: 'Fabcon base', dateAnalyzed: '2026-11-22' }),
    entry({ id: 'endorsed', submittedBy: 'Ana', endorsedTo: 'Roy', dateAnalyzed: '2026-11-24' }),
    entry({ id: 'other', submittedBy: 'Ana', dateAnalyzed: '2026-11-24' }),
    entry({ id: 'released', status: 'RELEASED', dateAnalyzed: '2026-11-24' }),
  ], 'Roy', now);
  assert.deepEqual(list.map(r => [r.entry.id, r.inDays]), [['liquid', 0], ['endorsed', 0], ['fabcon', 1]]);
});
