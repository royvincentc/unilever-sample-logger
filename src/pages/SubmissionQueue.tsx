import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Trash2, RefreshCw, AlertCircle, Clock, CheckCircle2, Loader2, Inbox } from 'lucide-react';
import Header from '../components/Layout/Header';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { getQueueItems, removeFromQueue, updateQueueItem } from '../utils/db';
import { sendToWebhook } from '../utils/api';
import type { QueueItem } from '../types';

interface Props {
  theme: 'light' | 'dark' | 'system';
  onSetTheme: (t: 'light' | 'dark' | 'system') => void;
  onQueueUpdate: () => void;
}

const cfg: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  queued:  { icon: Clock, color: 'text-warning-500', bg: 'bg-warning-500/10', label: 'Queued' },
  sending: { icon: Loader2, color: 'text-primary-500', bg: 'bg-primary-500/10', label: 'Sending' },
  success: { icon: CheckCircle2, color: 'text-success-500', bg: 'bg-success-500/10', label: 'Done' },
  failed:  { icon: AlertCircle, color: 'text-danger-500', bg: 'bg-danger-500/10', label: 'Failed' },
};

export default function SubmissionQueue({ theme, onSetTheme, onQueueUpdate }: Props) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const { showToast } = useToast();

  const refresh = async () => { const all = await getQueueItems(); setItems(all); onQueueUpdate(); };
  useEffect(() => { refresh(); }, []);

  const handleRetry = async (item: QueueItem) => {
    setRetrying(item.id);
    await updateQueueItem({ ...item, status: 'sending', lastAttempt: new Date().toISOString() });
    await refresh();
    const ep = item.sampleType === 'ENVI' ? 'envi' as const : item.sampleType === 'WATER' ? 'water' as const : 'rawmats' as const;
    const r = await sendToWebhook(ep, item.formData as unknown as Record<string, unknown>);
    if (r.success) {
      await removeFromQueue(item.id);
      showToast('success', 'Sent!', `${item.sampleType} succeeded`);
    } else {
      await updateQueueItem({ ...item, status: 'failed', errorMessage: r.error, lastAttempt: new Date().toISOString() });
      showToast('error', 'Failed', r.error || 'Unknown');
    }
    setRetrying(null);
    await refresh();
  };

  const handleDelete = async (id: string) => {
    await removeFromQueue(id);
    showToast('info', 'Removed');
    await refresh();
  };

  const handleRetryAll = async () => {
    setRetryingAll(true);
    for (const i of items.filter(i => i.status === 'queued' || i.status === 'failed')) await handleRetry(i);
    setRetryingAll(false);
  };

  const pending = items.filter(i => i.status === 'queued' || i.status === 'failed').length;

  return (
    <div>
      <Header theme={theme} onSetTheme={onSetTheme} title="Queue" />
      <div className="px-4 lg:px-8 max-w-3xl space-y-4">
        {pending > 0 && (
          <Button variant="primary" size="sm" loading={retryingAll} icon={<RefreshCw className="w-4 h-4" />} onClick={handleRetryAll}>
            Retry All ({pending})
          </Button>
        )}
        {items.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-12 text-center">
            <Inbox className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">Queue is empty</p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {items.map(item => {
              const c = cfg[item.status]; const Icon = c.icon;
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }} className="glass rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.bg}`}>
                        <Icon className={`w-5 h-5 ${c.color} ${item.status === 'sending' ? 'animate-spin' : ''}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.color}`}>{item.sampleType}</span>
                          <span className={`text-xs font-medium ${c.color}`}>{c.label}</span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                        {item.errorMessage && <p className="text-xs text-danger-500 mt-1">{item.errorMessage}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(item.status === 'queued' || item.status === 'failed') && (
                        <>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleRetry(item)} disabled={retrying === item.id}
                            className="p-2 rounded-lg hover:bg-primary-500/10 text-primary-500 transition-colors cursor-pointer disabled:opacity-50">
                            <RotateCcw className={`w-4 h-4 ${retrying === item.id ? 'animate-spin' : ''}`} />
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDelete(item.id)}
                            className="p-2 rounded-lg hover:bg-danger-500/10 text-danger-500 transition-colors cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
