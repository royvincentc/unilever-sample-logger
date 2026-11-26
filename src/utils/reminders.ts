import type { HistoryEntry } from '../types';

export interface Reminder { key: string; entry: HistoryEntry; reading: string; inDays: 0 | 1 }

const DAY = 86_400_000;

/** Readings a record needs, as [days after analysis, label]. */
function readingsFor(entry: HistoryEntry): Array<[number, string]> {
  if (entry.sampleType === 'WATER') return [[2, '2nd day reading'], [7, '7th day reading'], [14, '14th day reading']];
  if (entry.sampleType !== 'RawMats') return [];
  const name = (entry.sampleName || '').toLowerCase();
  if (name.includes('liquid') || name.includes('detergent')) return [[3, 'Indicative reading (3 days)']];
  if (name.includes('fabric') || name.includes('fabcon')) return [[5, 'Indicative reading (5 days)']];
  return [];
}

/** Local midnight of the day counting starts. Bare YYYY-MM-DD parses as UTC, which is the wrong day west of Greenwich. */
function startDay(entry: HistoryEntry) {
  const raw = entry.dateAnalyzed || entry.dateSampled || entry.submittedAt;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw || '');
  const date = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]) : new Date(raw);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Open readings for this analyst due today or tomorrow, today first. */
export function dueReminders(history: HistoryEntry[], userName: string, now = new Date()): Reminder[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return history.flatMap(entry => {
    if (entry.submittedBy !== userName && entry.endorsedTo !== userName) return [];
    if (entry.status === 'RELEASED' || entry.status === 'COMPLETED') return [];
    const start = startDay(entry);
    if (Number.isNaN(start.getTime())) return [];
    return readingsFor(entry).flatMap(([days, reading]) => {
      const due = new Date(start);
      due.setDate(due.getDate() + days);
      const inDays = Math.round((due.getTime() - today.getTime()) / DAY);
      return inDays === 0 || inDays === 1 ? [{ key: `${entry.id}-${days}`, entry, reading, inDays } as Reminder] : [];
    });
  }).sort((a, b) => a.inDays - b.inDays);
}
