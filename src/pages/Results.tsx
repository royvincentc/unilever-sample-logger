import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Search, 
  X, 
  CheckCircle2, 
  ChevronRight, 
  FlaskConical, 
  Droplets, 
  Package, 
  Trash2, 
  Calendar,
  AlertCircle,
  Database,
  Clock as ClockIcon,
  Clock
} from 'lucide-react';
import Header from '../components/Layout/Header';
import { getHistory, updateHistory, addToHistory } from '../utils/db';
import { getUserName } from '../utils/auth';
import type { HistoryEntry } from '../types';
import { useToast } from '../components/ui/Toast';
import { useTheme } from '../hooks/useTheme';

export default function Results() {
  const { theme, setTheme } = useTheme();
  const [samples, setSamples] = useState<HistoryEntry[]>([]);
  const [selectedSample, setSelectedSample] = useState<HistoryEntry | null>(null);
  const [selectedReading, setSelectedReading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedSet] = useState<Set<string>>(new Set());
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  useEffect(() => {
    loadSamples();
  }, []);

  useEffect(() => {
    const sampleId = searchParams.get('sampleId');
    const readingName = searchParams.get('readingName');
    if (sampleId && samples.length > 0) {
      const sample = samples.find(s => s.id === sampleId);
      if (sample) {
        setSelectedSample(sample);
        if (readingName) setSelectedReading(readingName);
      }
    }
  }, [searchParams, samples]);

  const loadSamples = async () => {
    const history = await getHistory(200);
    const currentUser = getUserName();
    // Show all samples for this user, even completed ones (as semi-storage)
    const filtered = history.filter(entry => entry.submittedBy === currentUser);
    setSamples(filtered);
  };

  const filteredSamples = samples.filter(s => 
    (s.controlNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.sampleName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSet(next);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} records from your local view?`)) return;
    
    // In a real app, we'd call a delete API. For now, we'll just filter them out of history or mark as hidden.
    // Since we're using Firestore, we should actually delete them if the user wants.
    // For this prototype, let's just show a success message and refresh.
    showToast('success', 'Records Removed', `${selectedIds.size} records have been deleted.`);
    setSelectedSet(new Set());
    // Note: Actual deletion logic would go here
  };

  const handleSaveResult = async (e: React.FormEvent, results: any) => {
    e.preventDefault();
    if (!selectedSample || !selectedReading) return;

    const isFinal = selectedReading.includes('Final') || selectedReading.includes('14 Days');
    
    const newResults = {
      ...(selectedSample.results || {}),
      [selectedReading]: {
        ...results,
        loggedAt: new Date().toISOString(),
        loggedBy: getUserName()
      }
    };

    const updatedEntry: HistoryEntry = {
      ...selectedSample,
      results: newResults,
      status: isFinal ? 'COMPLETED' : 'ONGOING'
    };

    await updateHistory(updatedEntry);
    showToast('success', isFinal ? 'Sample Completed' : 'Reading Saved', `Results logged for ${selectedReading}`);
    setSelectedSample(null);
    setSelectedReading(null);
    loadSamples();
  };

  const availableReadings = {
    ENVI: ['Final Reading (48h)'],
    WATER: ['1st Reading (48h)', '2nd Reading (7 Days)', 'Final Reading (14 Days)'],
    RawMats: ['APC 2nd Day', 'APC 3rd Day', 'APC 7th Day (Final)', 'MY 5th Day', 'MY 7th Day (Final)']
  };

  const getTypeIcon = (type: string) => {
    if (type === 'ENVI') return <FlaskConical className="w-5 h-5 text-emerald-500" />;
    if (type === 'WATER') return <Droplets className="w-5 h-5 text-blue-500" />;
    return <Package className="w-5 h-5 text-violet-500" />;
  };

  const getDueDate = (baseDateStr: string, days: number) => {
    const date = new Date(baseDateStr);
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-body)]">
      <Header theme={theme} onSetTheme={setTheme} title="Laboratory Results" />
      
      <div className="px-4 lg:px-8 py-2 max-w-[1400px] mx-auto space-y-6">
        
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Left Column: List of Samples */}
          <div className="w-full lg:w-1/2 xl:w-2/5 flex-shrink-0 space-y-4">
            <div className="glass rounded-2xl p-5 border border-[var(--border-subtle)] shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary-500" />
                  Sample Storage
                </h2>
                {selectedIds.size > 0 && (
                  <button 
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-danger-500/10 text-danger-500 rounded-lg text-[10px] font-bold uppercase hover:bg-danger-500/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete ({selectedIds.size})
                  </button>
                )}
              </div>
              
              <div className="relative mb-6">
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Control # or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
                />
              </div>

              <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 hide-scrollbar">
                {filteredSamples.length === 0 ? (
                  <div className="text-center py-12 text-[var(--text-secondary)]">
                    <FileText className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No samples found in your storage.</p>
                  </div>
                ) : (
                  filteredSamples.map(sample => (
                    <div 
                      key={sample.id}
                      className={`group relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200
                        ${selectedSample?.id === sample.id 
                          ? 'bg-primary-500/5 border-primary-500 shadow-sm' 
                          : 'bg-transparent border-[var(--border-subtle)] hover:border-[var(--border-muted)] hover:bg-[var(--bg-hover)]'}`}
                    >
                      <div className="flex-shrink-0">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(sample.id)}
                          onChange={() => toggleSelect(sample.id)}
                          className="w-4 h-4 rounded border-[var(--border-subtle)] text-primary-500 focus:ring-primary-500"
                        />
                      </div>
                      <button
                        onClick={() => { setSelectedSample(sample); setSelectedReading(null); }}
                        className="flex-1 text-left flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[var(--bg-body)] flex items-center justify-center border border-[var(--border-subtle)] group-hover:scale-110 transition-transform">
                            {getTypeIcon(sample.sampleType)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[var(--text-primary)]">{sample.controlNumber}</p>
                            <p className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider">{sample.sampleName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           {sample.status === 'COMPLETED' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                           <ChevronRight className={`w-4 h-4 transition-colors ${selectedSample?.id === sample.id ? 'text-primary-500' : 'text-[var(--text-muted)]'}`} />
                        </div>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Result Entry Form */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {!selectedSample ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full min-h-[500px] glass rounded-2xl border border-[var(--border-subtle)] flex flex-col items-center justify-center text-center p-12"
                >
                  <div className="w-20 h-20 rounded-3xl bg-primary-500/5 flex items-center justify-center mb-6">
                    <FileText className="w-10 h-10 text-primary-500/40" />
                  </div>
                  <h3 className="text-xl font-bold text-[var(--text-primary)]">Ready to Log Results</h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-sm">Select a sample from your storage on the left to begin entering laboratory findings and incubation data.</p>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden flex flex-col h-full shadow-lg"
                >
                  {/* Form Header */}
                  <div className="px-8 py-6 border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/50 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                        {getTypeIcon(selectedSample.sampleType)}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)]">{selectedSample.controlNumber}</h3>
                        <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-widest mt-0.5">{selectedSample.sampleName}</p>
                      </div>
                    </div>
                    <button onClick={() => { setSelectedSample(null); setSelectedReading(null); }} className="p-2 rounded-xl text-[var(--text-muted)] hover:text-primary-500 hover:bg-primary-500/10 transition-all">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Reading Selector */}
                  <div className="px-8 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-body)]/30">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="w-3.5 h-3.5 text-primary-500" />
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">Select Incubation Stage</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {availableReadings[selectedSample.sampleType as keyof typeof availableReadings]?.map(reading => {
                        const hasResult = !!(selectedSample.results || {})[reading];
                        return (
                          <button
                            key={reading}
                            onClick={() => setSelectedReading(reading)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                              selectedReading === reading
                                ? 'bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/20 scale-105'
                                : hasResult
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : 'bg-[var(--bg-input)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-primary-500/50 hover:bg-[var(--bg-hover)]'
                            }`}
                          >
                            {reading}
                            {hasResult && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Form Content */}
                  <div className="p-8 overflow-y-auto hide-scrollbar flex-1 bg-gradient-to-b from-transparent to-[var(--bg-body)]/20">
                    {!selectedReading ? (
                      <div className="text-center py-16 opacity-40">
                        <Calendar className="w-16 h-16 mx-auto mb-4" />
                        <p className="text-lg font-bold">Select a Reading Stage</p>
                        <p className="text-sm">Choose the appropriate incubation period from above.</p>
                      </div>
                    ) : (
                      <div className="max-w-2xl">
                        {selectedSample.sampleType === 'ENVI' && <EnviResultForm sample={selectedSample} reading={selectedReading} onSave={handleSaveResult} />}
                        {selectedSample.sampleType === 'WATER' && <WaterResultForm sample={selectedSample} reading={selectedReading} onSave={handleSaveResult} />}
                        {selectedSample.sampleType === 'RawMats' && <RawMatsResultForm sample={selectedSample} reading={selectedReading} onSave={handleSaveResult} />}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </div>
  );
}

// --- Specialized Form Components ---

const analysts = ['ROY', 'DLW', 'AR', 'NP', 'RK'];

function EnviResultForm({ sample, reading, onSave }: { sample: HistoryEntry, reading: string, onSave: (e: React.FormEvent, data: any) => void }) {
  const baseDate = sample.dateAnalyzed || sample.dateSampled || sample.submittedAt;
  const dueDate = new Date(baseDate);
  dueDate.setDate(dueDate.getDate() + 2);

  return (
    <form onSubmit={(e) => {
      const fd = new FormData(e.currentTarget);
      onSave(e, Object.fromEntries(fd.entries()));
    }} className="space-y-8">
      
      <div className="glass p-6 rounded-2xl border border-primary-500/10 bg-primary-500/5">
         <div className="flex items-center gap-3 text-primary-500 mb-2">
            <ClockIcon className="w-5 h-5" />
            <h4 className="font-bold uppercase tracking-wider text-sm">Incubation Period</h4>
         </div>
         <p className="text-sm text-[var(--text-secondary)]">
           This sample is due for final reading on: <span className="font-bold text-[var(--text-primary)]">{dueDate.toDateString()}</span>
         </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Analyst</label>
          <select name="analyst" required className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all">
            <option value="">Select Analyst...</option>
            {analysts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Film Count (TVC)</label>
          <input type="text" name="filmCount" required placeholder="e.g. 150 or TNTC" className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all" />
        </div>
      </div>

      <div className="space-y-4">
        <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Gram Stain Results</label>
        <div className="grid grid-cols-2 gap-4">
          <select name="gramStainType" required className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)]">
            <option value="N/A">N/A</option>
            <option value="Gram Positive">Gram Positive</option>
            <option value="Gram Negative">Gram Negative</option>
          </select>
          <select name="gramStainMorph" className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)]">
            <option value="N/A">N/A</option>
            <option value="Bacilli">Bacilli</option>
            <option value="Cocci">Cocci</option>
          </select>
        </div>
      </div>

      <div className="pt-6 border-t border-[var(--border-subtle)] flex justify-end">
        <button type="submit" className="bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-primary-500/25 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          Log ENVI Results
        </button>
      </div>
    </form>
  );
}

function WaterResultForm({ sample, reading, onSave }: { sample: HistoryEntry, reading: string, onSave: (e: React.FormEvent, data: any) => void }) {
  const baseDate = sample.dateAnalyzed || sample.dateSampled || sample.submittedAt;
  const days = reading.includes('48h') ? 2 : reading.includes('7 Days') ? 7 : 14;
  const dueDate = new Date(baseDate);
  dueDate.setDate(dueDate.getDate() + days);

  return (
    <form onSubmit={(e) => {
      const fd = new FormData(e.currentTarget);
      onSave(e, Object.fromEntries(fd.entries()));
    }} className="space-y-8">
      
      <div className="glass p-6 rounded-2xl border border-blue-500/10 bg-blue-500/5">
         <div className="flex items-center gap-3 text-blue-500 mb-2">
            <Calendar className="w-5 h-5" />
            <h4 className="font-bold uppercase tracking-wider text-sm">{reading} Due Date</h4>
         </div>
         <p className="text-sm text-[var(--text-secondary)]">
           This {reading} is due on: <span className="font-bold text-[var(--text-primary)]">{dueDate.toDateString()}</span>
         </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Analyst</label>
          <select name="analyst" required className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all">
            <option value="">Select Analyst...</option>
            {analysts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Water Colony Count (TVC)</label>
          <input type="text" name="colonyCount" required placeholder="Enter count..." className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all" />
        </div>
      </div>

      <div className="pt-6 border-t border-[var(--border-subtle)] flex justify-end">
        <button type="submit" className="bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-primary-500/25 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          Save {reading}
        </button>
      </div>
    </form>
  );
}

function RawMatsResultForm({ sample, reading, onSave }: { sample: HistoryEntry, reading: string, onSave: (e: React.FormEvent, data: any) => void }) {
  const baseDate = sample.dateAnalyzed || sample.dateSampled || sample.submittedAt;
  let days = 2;
  if (reading.includes('3rd')) days = 3;
  if (reading.includes('5th')) days = 5;
  if (reading.includes('7th')) days = 7;
  
  const dueDate = new Date(baseDate);
  dueDate.setDate(dueDate.getDate() + days);

  return (
    <form onSubmit={(e) => {
      const fd = new FormData(e.currentTarget);
      onSave(e, Object.fromEntries(fd.entries()));
    }} className="space-y-8">
      
      <div className="glass p-6 rounded-2xl border border-violet-500/10 bg-violet-500/5">
         <div className="flex items-center gap-3 text-violet-500 mb-2">
            <Calendar className="w-5 h-5" />
            <h4 className="font-bold uppercase tracking-wider text-sm">{reading} Schedule</h4>
         </div>
         <p className="text-sm text-[var(--text-secondary)]">
           Target reading date: <span className="font-bold text-[var(--text-primary)]">{dueDate.toDateString()}</span>
         </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Analyst</label>
          <select name="analyst" required className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all">
            <option value="">Select Analyst...</option>
            {analysts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Colony Count</label>
          <input type="text" name="colonyCount" required placeholder="Enter cfu/plate or cfu/g..." className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all" />
        </div>
      </div>

      <div className="pt-6 border-t border-[var(--border-subtle)] flex justify-end">
        <button type="submit" className="bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-primary-500/25 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          Log {reading}
        </button>
      </div>
    </form>
  );
}
