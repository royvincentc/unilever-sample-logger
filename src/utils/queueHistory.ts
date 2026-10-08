import type { HistoryEntry, QueueItem } from '../types';
import { resolveColumn } from '../hooks/useSheetSchema';

/** Retry payloads may already be keyed by live sheet headers. */
export function historyFromQueuedSample(item: QueueItem, assignedControlNumber?: string): HistoryEntry {
  const payload = item.formData as unknown as Record<string, unknown>;
  const read = (field: string) => {
    const key = resolveColumn(field, Object.keys(payload), new Set(), true);
    return String((key ? payload[key] : payload[field]) ?? '');
  };
  let controlNumber = assignedControlNumber && assignedControlNumber !== 'N/A' && !assignedControlNumber.includes('{{')
    ? assignedControlNumber : item.controlNumber || 'UNKNOWN';
  if (item.sampleType === 'RawMats') controlNumber = controlNumber.replace(/^RM-?/i, '');
  const dateSampled = read('dateSampled');
  return {
    id: `${controlNumber}-${item.sampleName}-${Date.now()}`,
    sampleType: item.sampleType, controlNumber, sampleName: item.sampleName || 'Queued Sample',
    dateSampled, dateAnalyzed: read('dateAnalyzed') || dateSampled,
    rawMatsType: read('type') || undefined, status: (read('status') || 'ON GOING') as HistoryEntry['status'],
    submittedAt: new Date().toISOString(), submittedBy: item.submittedBy || 'Unknown User',
  };
}
