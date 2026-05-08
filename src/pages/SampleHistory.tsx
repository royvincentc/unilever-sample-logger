import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, FileText } from 'lucide-react';
import Header from '../components/Layout/Header';
import StatusBadge from '../components/ui/StatusBadge';
import { getHistory, importHistoryBatch } from '../utils/db';
import { getUserName } from '../utils/auth';
import { fetchHistoryFromSheet } from '../utils/api';
import type { HistoryEntry } from '../types';

interface Props {
  theme: 'light' | 'dark' | 'system';
  onSetTheme: (t: 'light' | 'dark' | 'system') => void;
}

export default function SampleHistory({ theme, onSetTheme }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  
  const loadHistory = useCallback(async () => {
    const currentUser = getUserName();
    const history = await getHistory(100);
    const myHistory = history.filter(e => e.submittedBy === currentUser);
    setEntries(myHistory);
  }, []);

  useEffect(() => { 
    loadHistory();
    
    // Background sync to ensure history is synced across devices
    const autoSync = async () => {
      try {
        const sheetHistory = await fetchHistoryFromSheet();
        if (sheetHistory.length > 0) {
          await importHistoryBatch(sheetHistory);
          loadHistory();
        }
      } catch (e) {
        console.error('History sync failed', e);
      }
    };
    autoSync();
  }, [loadHistory]);

  const badge = (type: string) =>
    type === 'ENVI' ? 'from-emerald-500 to-teal-500' :
    type === 'WATER' ? 'from-blue-500 to-cyan-500' : 'from-violet-500 to-purple-500';
  const letter = (type: string) => type === 'ENVI' ? 'E' : type === 'WATER' ? 'W' : 'R';

  return (
    <div>
      <Header theme={theme} onSetTheme={onSetTheme} title="History" />
      <div className="px-4 lg:px-8 max-w-3xl">
        {entries.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-12 text-center">
            <Clock className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">No history yet</p>
          </motion.div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden divide-y divide-[var(--border-subtle)]">
            {entries.map((e) => (
              <button 
                key={e.id} 
                onClick={() => setSelectedEntry(e)}
                className="w-full text-left flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br ${badge(e.sampleType)}`}>
                    {letter(e.sampleType)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{e.controlNumber}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{e.sampleName} · {new Date(e.submittedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <StatusBadge status={e.status} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md max-h-[85vh] bg-[var(--bg-body)] border border-[var(--border-subtle)] rounded-2xl shadow-xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)] flex items-center justify-between sticky top-0">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br ${badge(selectedEntry.sampleType)}`}>
                    {letter(selectedEntry.sampleType)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">{selectedEntry.controlNumber}</h3>
                    <p className="text-xs text-[var(--text-secondary)] truncate max-w-[200px]">{selectedEntry.sampleName}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedEntry(null)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 overflow-y-auto custom-scrollbar space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Sample Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[var(--text-muted)] text-xs mb-1">Status</p>
                      <StatusBadge status={selectedEntry.status} />
                    </div>
                    <div>
                      <p className="text-[var(--text-muted)] text-xs mb-1">Submitted</p>
                      <p className="font-medium text-[var(--text-primary)]">{new Date(selectedEntry.submittedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary-500" />
                    Logged Results
                  </h4>
                  
                  {(!selectedEntry.results || Object.keys(selectedEntry.results).length === 0) ? (
                    <div className="bg-[var(--bg-input)] rounded-xl p-4 text-center border border-[var(--border-subtle)]">
                      <p className="text-sm text-[var(--text-muted)]">No results logged yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Handle both old format (flat object) and new format (nested by reading) */}
                      {Object.entries(selectedEntry.results).map(([key, value]) => {
                        const isNested = typeof value === 'object' && value !== null;
                        
                        if (isNested) {
                          // New format: key is the reading name, value is the result object
                          return (
                            <div key={key} className="bg-[var(--bg-input)] rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                              <div className="bg-[var(--bg-hover)] px-3 py-2 border-b border-[var(--border-subtle)]">
                                <p className="text-xs font-bold text-[var(--text-primary)]">{key}</p>
                              </div>
                              <div className="p-3 space-y-2">
                                {Object.entries(value as object).map(([k, v]) => (
                                  <div key={k} className="flex justify-between items-center text-sm border-b border-[var(--border-subtle)] border-dashed pb-1 last:border-0 last:pb-0">
                                    <span className="text-[var(--text-secondary)]">{k}</span>
                                    <span className="font-medium text-[var(--text-primary)]">{String(v)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        } else {
                          // Old format: just key-value pairs (wrap in a default block)
                          return (
                            <div key={key} className="flex justify-between items-center text-sm border-b border-[var(--border-subtle)] border-dashed pb-2">
                              <span className="text-[var(--text-secondary)]">{key}</span>
                              <span className="font-medium text-[var(--text-primary)]">{String(value)}</span>
                            </div>
                          );
                        }
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
