import { useState, useEffect, useCallback } from 'react';
import type { QueueItem } from '../types';
import { addToQueue, getQueueItems, updateQueueItem, removeFromQueue, addToHistory } from '../utils/db';
import { sendToWebhook } from '../utils/api';
import { historyFromQueuedSample } from '../utils/queueHistory';

export function useSubmissionQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const all = await getQueueItems();
    setItems(all);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enqueue = useCallback(async (item: QueueItem) => {
    await addToQueue(item);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await removeFromQueue(id);
    await refresh();
  }, [refresh]);

  const updateItem = useCallback(async (item: QueueItem) => {
    await updateQueueItem(item);
    await refresh();
  }, [refresh]);

  const retry = useCallback(async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const sending: QueueItem = { ...item, status: 'sending', lastAttempt: new Date().toISOString() };
    await updateQueueItem(sending);
    await refresh();

    const endpoint = item.sampleType === 'ENVI' ? 'envi' : item.sampleType === 'WATER' ? 'water' : item.sampleType === 'AIR' ? 'air' : 'rawmats';
    const result = await sendToWebhook(endpoint, item.formData as unknown as Record<string, unknown>);

    if (result.success) {
      const entry = historyFromQueuedSample(item, result.controlNumber);
      await updateQueueItem({ ...item, status: 'success', errorMessage: undefined, controlNumber: entry.controlNumber });
      try {
        await addToHistory(entry);
        await removeFromQueue(id);
      } catch {
        // Retain the accepted record locally; it must not be sent again.
      }
    } else {
      const failed: QueueItem = {
        ...sending,
        status: 'failed',
        errorMessage: result.error || 'Unknown error',
      };
      await updateQueueItem(failed);
    }
    await refresh();
    return result;
  }, [items, refresh]);

  const retryAll = useCallback(async () => {
    setSyncing(true);
    const pending = items.filter(i => i.status === 'queued' || i.status === 'failed');
    for (const item of pending) {
      await retry(item.id);
    }
    setSyncing(false);
  }, [items, retry]);

  const pendingCount = items.filter(i => i.status === 'queued' || i.status === 'failed').length;

  return {
    items,
    syncing,
    pendingCount,
    enqueue,
    remove,
    updateItem,
    retry,
    retryAll,
    refresh,
  };
}
