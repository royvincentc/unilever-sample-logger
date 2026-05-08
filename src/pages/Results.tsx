import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Search, X, CheckCircle2, ChevronRight, FlaskConical, Droplets, Package } from 'lucide-react';
import Header from '../components/Layout/Header';
import { getHistory, updateHistory } from '../utils/db';
import type { HistoryEntry } from '../types';
import { useToast } from '../components/ui/Toast';

interface Props {
  theme: 'light' | 'dark' | 'system';
  onSetTheme: (t: 'light' | 'dark' | 'system') => void;
}

export default function Results({ theme, onSetTheme }: Props) {
  const [pendingSamples, setPendingSamples] = useState<HistoryEntry[]>([]);
  const [selectedSample, setSelectedSample] = useState<HistoryEntry | null>(null);
  const [selectedReading, setSelectedReading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  useEffect(() => {
    loadSamples();
  }, []);

  useEffect(() => {
    const sampleId = searchParams.get('sampleId');
    const readingName = searchParams.get('readingName');
    if (sampleId && pendingSamples.length > 0) {
      const sample = pendingSamples.find(s => s.id === sampleId);
      if (sample) {
        setSelectedSample(sample);
        if (readingName) setSelectedReading(readingName);
      }
    }
  }, [searchParams, pendingSamples]);

  const loadSamples = async () => {
    const history = await getHistory(100);
    // Show samples that aren't completed yet
    const pending = history.filter(entry => 
      entry.status !== 'COMPLETED' && entry.status !== 'RELEASED'
    );
    setPendingSamples(pending);
  };

  const filteredSamples = pendingSamples.filter(s => 
    (s.controlNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.sampleName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveResult = async (e: React.FormEvent, results: any) => {
    e.preventDefault();
    if (!selectedSample || !selectedReading) return;

    const isFinal = selectedReading.includes('Final');
    
    // Append the new reading to existing results without overwriting previous readings
    const newResults = {
      ...(selectedSample.results || {}),
      [selectedReading]: results
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
    loadSamples(); // Refresh list
  };

  const availableReadings = {
    ENVI: ['Final Reading (48h)'],
    WATER: ['1st Reading (48h)', '2nd Reading (7 Days)', 'Final Reading (14 Days)'],
    RawMats: ['APC Initial (3 Days)', 'APC Final (7 Days)', 'MY Initial (5 Days)', 'MY Final (7 Days)']
  };

  const getTypeIcon = (type: string) => {
    if (type === 'ENVI') return <FlaskConical className="w-5 h-5 text-emerald-500" />;
    if (type === 'WATER') return <Droplets className="w-5 h-5 text-blue-500" />;
    return <Package className="w-5 h-5 text-violet-500" />;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-body)]">
      <Header theme={theme} onSetTheme={onSetTheme} title="Reports & Results" />
      
      <div className="px-4 lg:px-8 py-2 max-w-[1200px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Left Column: List of Pending Samples */}
          <div className="w-full lg:w-1/2 xl:w-2/5 flex-shrink-0 space-y-4">
            <div className="glass rounded-xl p-4 border border-[var(--border-subtle)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-500" />
                Pending Results
              </h2>
              
              <div className="relative mb-4">
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by ID or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg py-2 pl-9 pr-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredSamples.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-secondary)] text-sm">
                    No pending samples found.
                  </div>
                ) : (
                  filteredSamples.map(sample => (
                    <button
                      key={sample.id}
                      onClick={() => { setSelectedSample(sample); setSelectedReading(null); }}
                      className={`w-full text-left p-3 rounded-lg border transition-all duration-200 flex items-center justify-between group
                        ${selectedSample?.id === sample.id 
                          ? 'bg-[var(--bg-hover)] border-primary-500 shadow-sm' 
                          : 'bg-transparent border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-muted)]'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-[var(--bg-body)] flex items-center justify-center border border-[var(--border-subtle)]">
                          {getTypeIcon(sample.sampleType)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[var(--text-primary)]">{sample.controlNumber}</p>
                          <p className="text-xs text-[var(--text-secondary)] truncate max-w-[180px]">{sample.sampleName}</p>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-colors ${selectedSample?.id === sample.id ? 'text-primary-500' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'}`} />
                    </button>
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
                  className="h-full min-h-[400px] glass rounded-xl border border-[var(--border-subtle)] flex flex-col items-center justify-center text-center p-8"
                >
                  <FileText className="w-12 h-12 text-[var(--text-muted)] mb-4" />
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">Select a Sample</h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">Choose a sample from the list to enter its laboratory results.</p>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="glass rounded-xl border border-[var(--border-subtle)] overflow-hidden flex flex-col h-full max-h-[800px]"
                >
                  <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)] flex items-center justify-between sticky top-0 z-10">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {getTypeIcon(selectedSample.sampleType)}
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Log Result: {selectedSample.controlNumber}</h3>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">{selectedSample.sampleName}</p>
                    </div>
                    <button onClick={() => { setSelectedSample(null); setSelectedReading(null); }} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-body)]">
                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Select Reading to Log</p>
                    <div className="flex flex-wrap gap-2">
                      {availableReadings[selectedSample.sampleType as keyof typeof availableReadings]?.map(reading => {
                        const hasResult = !!(selectedSample.results || {})[reading];
                        return (
                          <button
                            key={reading}
                            onClick={() => setSelectedReading(reading)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                              selectedReading === reading
                                ? 'bg-primary-500 text-white shadow-md'
                                : hasResult
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                                : 'bg-[var(--bg-input)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-primary-500/50 hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {reading}
                            {hasResult && <CheckCircle2 className={`w-3 h-3 ${selectedReading === reading ? 'text-white' : 'text-emerald-500'}`} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {!selectedReading ? (
                      <div className="text-center py-12">
                        <CheckCircle2 className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
                        <p className="text-[var(--text-primary)] font-medium">No Reading Selected</p>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">Please select a reading phase from the options above.</p>
                      </div>
                    ) : (
                      <>
                        {selectedSample.sampleType === 'ENVI' && <EnviResultForm sample={selectedSample} onSave={handleSaveResult} />}
                        {selectedSample.sampleType === 'WATER' && <WaterResultForm sample={selectedSample} onSave={handleSaveResult} />}
                        {selectedSample.sampleType === 'RawMats' && <RawMatsResultForm sample={selectedSample} onSave={handleSaveResult} />}
                      </>
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

// --- Form Components ---

const analysts = ['ROY', 'DLW', 'AR', 'NP', 'RK'];

function EnviResultForm({ sample, onSave }: { sample: HistoryEntry, onSave: (e: React.FormEvent, data: any) => void }) {
  return (
    <form onSubmit={(e) => {
      const fd = new FormData(e.currentTarget);
      onSave(e, Object.fromEntries(fd.entries()));
    }} className="space-y-6">
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Analyst</label>
          <select name="analyst" required className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors">
            <option value="">Select Analyst...</option>
            {analysts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Micro Reading</label>
          <select name="microReading" className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors">
            <option value="N/A">N/A</option>
            <option value="DONE">DONE</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">TVC (count)</label>
          <input type="text" name="tvcCount" required placeholder="e.g. 175 or TNTC" className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors" />
        </div>
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">TVC (cfu/100cm2)</label>
          <input type="text" name="tvcCfu" required placeholder="e.g. 1750" className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Gram Staining</label>
          <select name="gramStaining" required className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors">
            <option value="N/A">N/A</option>
            <option value="GRAM POSITIVE BACILLI">GRAM POSITIVE BACILLI</option>
            <option value="GRAM NEGATIVE BACILLI">GRAM NEGATIVE BACILLI</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Gram Negative</label>
          <input type="text" name="gramNegative" placeholder="Leave blank if N/A" className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors" />
        </div>
      </div>

      <div className="pt-4 mt-6 border-t border-[var(--border-subtle)] flex justify-end">
        <button type="submit" className="bg-primary-500 hover:bg-primary-600 text-white font-bold py-2.5 px-6 rounded-xl transition-colors flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          Save ENVI Result
        </button>
      </div>
    </form>
  );
}

function WaterResultForm({ sample, onSave }: { sample: HistoryEntry, onSave: (e: React.FormEvent, data: any) => void }) {
  return (
    <form onSubmit={(e) => {
      const fd = new FormData(e.currentTarget);
      onSave(e, Object.fromEntries(fd.entries()));
    }} className="space-y-6">
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Analyst</label>
          <select name="analyst" required className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors">
            <option value="">Select Analyst...</option>
            {analysts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Micro Reading</label>
          <input type="text" name="microReading" className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">TVC (count)</label>
          <input type="text" name="tvcCount" required placeholder="e.g. 9 or TNTC" className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors" />
        </div>
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">TVC (cfu/mL)</label>
          <input type="text" name="tvcCfu" required placeholder="e.g. 0.09" className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Gram Negative (count)</label>
          <input type="text" name="gramNegCount" required placeholder="e.g. 0" className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors" />
        </div>
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Gram Negative (cfu/g)</label>
          <input type="text" name="gramNegCfu" required placeholder="e.g. 0" className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors" />
        </div>
      </div>

      <div className="pt-4 mt-6 border-t border-[var(--border-subtle)] flex justify-end">
        <button type="submit" className="bg-primary-500 hover:bg-primary-600 text-white font-bold py-2.5 px-6 rounded-xl transition-colors flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          Save WATER Result
        </button>
      </div>
    </form>
  );
}

function RawMatsResultForm({ sample, onSave }: { sample: HistoryEntry, onSave: (e: React.FormEvent, data: any) => void }) {
  return (
    <form onSubmit={(e) => {
      const fd = new FormData(e.currentTarget);
      onSave(e, Object.fromEntries(fd.entries()));
    }} className="space-y-6">
      
      <div>
        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Analyst</label>
        <select name="analyst" required className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors">
          <option value="">Select Analyst...</option>
          {analysts.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-body)]">
        <h4 className="text-sm font-bold text-[var(--text-primary)] mb-4 uppercase tracking-wider flex items-center gap-2">
          <Package className="w-4 h-4 text-violet-500" />
          Actual Results (Counts)
        </h4>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">(A) Aerobic Plate Count</label>
            <input type="text" name="apcCount" required placeholder="e.g. 0 cfu/plate" className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">(A) Gram-Negative</label>
            <input type="text" name="gramNegCount" required placeholder="e.g. No Growth" className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">(A) Yeast and Molds</label>
            <input type="text" name="myCount" required placeholder="e.g. 0 cfu/plate" className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors" />
          </div>
        </div>
      </div>

      <div className="pt-4 mt-6 border-t border-[var(--border-subtle)] flex justify-end">
        <button type="submit" className="bg-primary-500 hover:bg-primary-600 text-white font-bold py-2.5 px-6 rounded-xl transition-colors flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          Save RawMats Result
        </button>
      </div>
    </form>
  );
}
