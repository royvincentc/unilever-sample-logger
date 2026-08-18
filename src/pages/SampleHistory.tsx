import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, FileText, Trash2, ChevronDown, Download } from 'lucide-react';
import Header from '../components/Layout/Header';
import StatusBadge from '../components/ui/StatusBadge';
import { useToast } from '../components/ui/Toast';
import { getHistory, listenToHistory, deleteFromHistory } from '../utils/db';
import { fetchHistoryFromSheet } from '../utils/api';
import { getSettings } from '../utils/auth';
import type { HistoryEntry } from '../types';
import { useTheme } from '../hooks/useTheme';

export default function SampleHistory() {
  const { theme, setTheme } = useTheme();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<string | null>(null);
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'ONGOING' | 'COMPLETED'>('ONGOING');
  const [activeAnalyst, setActiveAnalyst] = useState<string>('All');
  const [activeSampleType, setActiveSampleType] = useState<string>('All');

  const loadHistory = useCallback(async () => {
    const history = await getHistory(5000);
    setEntries(history);
  }, []);

  useEffect(() => { 
    loadHistory();
    const unsubscribe = listenToHistory((allEntries) => setEntries(allEntries));

    // Background sync to ensure history is synced across devices and statuses are updated
    const autoSync = async () => {
      try {
        const updatedIds = await fetchHistoryFromSheet();
        if (updatedIds.length > 0) {
          loadHistory();
        }
      } catch (e) {
        console.error('History sync failed', e);
      }
    };
    autoSync();
    
    return () => unsubscribe();
  }, [loadHistory]);

  const handleDelete = async (entry: HistoryEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete ${entry.controlNumber} - ${entry.sampleName}?`)) return;
    try {
      await deleteFromHistory(entry.id);
      showToast('success', 'Deleted', `${entry.controlNumber} removed`);
    } catch {
      showToast('error', 'Error', 'Failed to delete entry');
    }
  };

  const handleDownloadReport = async (entry: HistoryEntry, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (entry.sampleType !== 'ENVI' && entry.sampleType !== 'RawMats') {
      showToast('warning', 'Not Supported', 'Reports are only generated for ENVI and RawMats currently.');
      return;
    }
    
    setDownloading(entry.id);
    try {
      const settings = getSettings();
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleType: entry.sampleType,
          controlNumber: entry.controlNumber,
          spreadsheetId: settings.spreadsheetId,
          dateSampled: entry.dateSampled
        })
      });
      
      if (!response.ok) {
        throw new Error(await response.text());
      }
      
      // Trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_${entry.sampleType}_${entry.controlNumber}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      showToast('success', 'Report Downloaded', `Generated DOCX for ${entry.controlNumber}`);
    } catch (err: any) {
      showToast('error', 'Download Failed', err.message || 'Could not generate report.');
    } finally {
      setDownloading(null);
    }
  };

  const toggleGroup = (ctrlNum: string) => {
    const next = new Set(expandedGroups);
    if (next.has(ctrlNum)) next.delete(ctrlNum);
    else next.add(ctrlNum);
    setExpandedGroups(next);
  };

  const KNOWN_ANALYSTS = ['WAGAS', 'ALBESA', 'CAWIT', 'EDISAN', 'CODINERA', 'MARK', 'BARANGAN', 'CANOY', 'GOLORAN', 'VILLAVER', 'JUEN'];

  const allAnalysts = useMemo(() => {
    const analysts = new Set<string>(KNOWN_ANALYSTS);
    entries.forEach(e => {
      if (e.sheetAnalyst && e.sheetAnalyst !== '-') {
        analysts.add(e.sheetAnalyst.toUpperCase());
      }
    });
    return Array.from(analysts).sort();
  }, [entries]);

  // Helper to get the best analyst name for a given entry
  const getAnalyst = (e: HistoryEntry) => e.sheetAnalyst || e.endorsedTo || e.submittedBy || '';

  // Group entries by control number
  const groupedEntries = useMemo(() => {
    const groups: Record<string, HistoryEntry[]> = {};
    for (const e of entries) {
      if (activeSampleType !== 'All' && e.sampleType !== activeSampleType) {
        continue;
      }
      
      const entryAnalyst = getAnalyst(e);
      if (activeAnalyst !== 'All' && entryAnalyst !== activeAnalyst) {
        continue;
      }
      if (!groups[e.controlNumber]) groups[e.controlNumber] = [];
      groups[e.controlNumber].push(e);
    }
    
    // Sort groups alphabetically by the analyst of the first item, then by timestamp
    const sortedGroups = Object.entries(groups).sort((a, b) => {
      const analystA = getAnalyst(a[1][0]);
      const analystB = getAnalyst(b[1][0]);
      
      if (analystA < analystB) return -1;
      if (analystA > analystB) return 1;
      
      const maxA = Math.max(...a[1].map(x => new Date(x.submittedAt).getTime()));
      const maxB = Math.max(...b[1].map(x => new Date(x.submittedAt).getTime()));
      return maxB - maxA;
    });

    return sortedGroups.filter(([ctrlNum, group]) => {
      const statuses = group.map(g => g.status);
      let groupStatus = statuses[0];
      if (statuses.some(s => s === 'ONGOING' || s === 'ON GOING')) groupStatus = 'ONGOING';
      else if (statuses.some(s => s === 'PENDING RELEASE')) groupStatus = 'PENDING RELEASE';
      else if (statuses.every(s => s === 'COMPLETED' || s === 'RELEASED')) groupStatus = 'RELEASED';
      
      const isCompleted = groupStatus === 'RELEASED' || groupStatus === 'COMPLETED';
      return activeTab === 'COMPLETED' ? isCompleted : !isCompleted;
    });
  }, [entries, activeAnalyst, activeTab, activeSampleType]);

  const badge = (type: string) =>
    type === 'ENVI' ? 'from-emerald-500 to-teal-500' :
    type === 'WATER' ? 'from-blue-500 to-cyan-500' : 'from-violet-500 to-purple-500';
  const letter = (type: string) => type === 'ENVI' ? 'E' : type === 'WATER' ? 'W' : 'R';

  return (
    <div>
      <Header theme={theme} onSetTheme={setTheme} title="History" />
      <div className="px-4 lg:px-8 max-w-4xl mx-auto pb-12">
        
        {/* Filter Controls */}
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Tabs */}
            <div className="flex bg-[var(--bg-input)] rounded-xl p-1 border border-[var(--border-subtle)] shadow-sm w-full md:w-auto">
              <button
                onClick={() => setActiveTab('ONGOING')}
                className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ONGOING' ? 'bg-primary-500 text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
              >
                Ongoing
              </button>
              <button
                onClick={() => setActiveTab('COMPLETED')}
                className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'COMPLETED' ? 'bg-primary-500 text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
              >
                Completed
              </button>
            </div>

            {/* Analyst Filter Dropdown */}
            <div className="w-full md:w-auto flex flex-col md:flex-row items-center gap-3">
              <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider hidden md:block">Sort By</span>
              <select
                value={activeAnalyst}
                onChange={(e) => setActiveAnalyst(e.target.value)}
                className="w-full md:w-64 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all shadow-sm"
              >
                <option value="All">All Analysts</option>
                {allAnalysts.map(analyst => (
                  <option key={analyst} value={analyst}>{analyst}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sample Type Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {['All', 'ENVI', 'WATER', 'RawMats', 'AIR'].map(type => (
              <button
                key={type}
                onClick={() => setActiveSampleType(type)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border shadow-sm ${
                  activeSampleType === type 
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {groupedEntries.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-12 text-center">
            <Clock className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">
              {entries.length === 0 ? "No history yet" : "No samples found for this filter."}
            </p>
          </motion.div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] shadow-sm">
            {groupedEntries.map(([ctrlNum, group]) => {
              const isExpanded = expandedGroups.has(ctrlNum);
              const sampleType = group[0].sampleType;
              const dateSampled = group[0].dateSampled;
              
              // Calculate group status based on children
              const statuses = group.map(g => g.status);
              let groupStatus = statuses[0];
              if (statuses.some(s => s === 'ONGOING' || s === 'ON GOING')) groupStatus = 'ONGOING';
              else if (statuses.some(s => s === 'PENDING RELEASE')) groupStatus = 'PENDING RELEASE';
              else if (statuses.every(s => s === 'COMPLETED' || s === 'RELEASED')) groupStatus = 'RELEASED';
              
              const isCompleted = groupStatus === 'RELEASED' || groupStatus === 'COMPLETED';

              return (
                <div key={ctrlNum} className="flex flex-col">
                  {/* Group Header */}
                  <div 
                    onClick={() => toggleGroup(ctrlNum)}
                    className={`w-full text-left flex items-center justify-between px-5 py-4 transition-colors cursor-pointer ${isExpanded ? 'bg-[var(--bg-hover)]/50' : 'hover:bg-[var(--bg-hover)]'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br shadow-md ${badge(sampleType)}`}>
                        {letter(sampleType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-bold text-[var(--text-primary)] tracking-wide">{ctrlNum}</p>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                            {group.length} {group.length === 1 ? 'Sample' : 'Samples'}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">{sampleType} • Sampled: {new Date(dateSampled).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {isCompleted && (sampleType === 'ENVI' || sampleType === 'RawMats') && (
                        <button
                          onClick={(e) => handleDownloadReport(group[0], e)}
                          disabled={downloading === group[0].id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {downloading === group[0].id ? '...' : 'Report'}
                        </button>
                      )}
                      <StatusBadge status={groupStatus} />
                      <div className={`p-1 text-[var(--text-muted)] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Group Children (Accordion) */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-[var(--bg-sidebar)]/30 border-t border-[var(--border-subtle)] border-dashed"
                      >
                        <div className="px-5 py-3 divide-y divide-[var(--border-subtle)]/50">
                          {group.map(e => (
                            <div key={e.id} className="flex items-center justify-between py-2 group">
                              <div className="flex-1 min-w-0 pr-4">
                                <button 
                                  onClick={() => setSelectedEntry(e)}
                                  className="text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors truncate block text-left"
                                >
                                  {e.sampleName}
                                </button>
                                <p className="text-[10px] text-[var(--text-muted)] mt-0.5 uppercase tracking-wider">Submitted: {new Date(e.submittedAt).toLocaleDateString()}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <StatusBadge status={e.status} />
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => setSelectedEntry(e)}
                                    className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-primary-500 hover:bg-primary-500/10 transition-colors"
                                    title="View Details"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>
                                  {(e.status === 'ONGOING' || e.status === 'ON GOING') && (
                                    <button
                                      onClick={(ev) => handleDelete(e, ev)}
                                      className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-danger-500 hover:bg-danger-500/10 transition-colors"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedEntry && (
          <motion.div 
            key="history-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedEntry(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-pointer"
          >
            <motion.div 
              key="history-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.35 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[85vh] bg-[var(--bg-body)] border border-[var(--border-subtle)] rounded-2xl shadow-xl flex flex-col overflow-hidden cursor-default"
            >
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
                <button onClick={() => setSelectedEntry(null)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

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
                  <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary-500" />
                      Logged Results
                    </span>
                  </h4>
                  
                  {(!selectedEntry.results || Object.keys(selectedEntry.results).length === 0) ? (
                    <div className="bg-[var(--bg-input)] rounded-xl p-4 text-center border border-[var(--border-subtle)]">
                      <p className="text-sm text-[var(--text-muted)]">No results logged yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(selectedEntry.results).map(([key, value]) => {
                        const isNested = typeof value === 'object' && value !== null;
                        if (isNested) {
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
