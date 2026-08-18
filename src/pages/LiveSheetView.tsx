import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, RefreshCw, AlertCircle, Search, Calendar, User, Clock as ClockIcon, CheckCircle2 } from 'lucide-react';
import Header from '../components/Layout/Header';
import { fetchLiveSheetData } from '../utils/api';
import { getSheetTabName } from '../utils/sheetMapping';
import { useTheme } from '../hooks/useTheme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import SampleTypeSelector from '../components/forms/SampleTypeSelector';
import type { SampleType } from '../types';

export default function LiveSheetView() {
  const { theme, setTheme } = useTheme();
  const [selectedType, setSelectedType] = useState<SampleType | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const isOnline = useOnlineStatus();

  const loadData = useCallback(async (type: SampleType) => {
    if (!isOnline) {
      setError('You are currently offline.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const sheetTab = getSheetTabName(type);
      const rows = await fetchLiveSheetData(sheetTab);
      
      // We removed the 'SAMPLE TYPE' filtering because the sheetTab itself 
      // (e.g. 'MAY ENVI') already guarantees the data matches the type.
      // Strict column filtering was discarding valid data if the header name varied.

      setData(rows || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data from the live sheet.');
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    if (selectedType) {
      loadData(selectedType);
    }
  }, [selectedType, loadData]);

  const normalizeRow = (rawRow: any) => {
    if (!rawRow) return {};
    const normalized: Record<string, any> = {};
    for (const key in rawRow) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      let val = rawRow[key];
      if (selectedType === 'RawMats' && (cleanKey === 'control' || cleanKey === 'controlnumber' || cleanKey === 'control')) {
        if (typeof val === 'string') {
          val = val.replace(/^RM-?/i, '');
        }
      }
      normalized[cleanKey] = val;
    }
    // Also keep the original row as fallback
    const result = { ...rawRow, ...normalized };
    if (selectedType === 'RawMats') {
      const origControl = result.control || result.controlnumber || result['CONTROL #'];
      if (typeof origControl === 'string') {
        const cleaned = origControl.replace(/^RM-?/i, '');
        result.control = cleaned;
        result.controlnumber = cleaned;
        result['CONTROL #'] = cleaned;
      }
    }
    return result;
  };

  const getStatusColor = (status: string) => {
    const s = String(status || '').toUpperCase();
    if (s.includes('COMPLETED') || s.includes('RELEASED')) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (s.includes('ONGOING') || s.includes('PROGRESS')) return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    if (s.includes('PENDING')) return 'text-warning-500 bg-warning-500/10 border-warning-500/20';
    return 'text-[var(--text-muted)] bg-[var(--bg-input)] border-[var(--border-subtle)]';
  };

  const filteredData = data.map(normalizeRow).filter(row => {
    const query = searchQuery.toLowerCase();
    const ctrl = String(row.control || row.controlnumber || row['CONTROL #'] || '').toLowerCase();
    const name = String(row.samplename || row.name || row.sampledetails || row.sample || row['SAMPLE NAME'] || '').toLowerCase();
    const collector = String(row.whocollected || row.collectedby || row.swabbedby || row['WHO COLLECTED'] || '').toLowerCase();
    return ctrl.includes(query) || name.includes(query) || collector.includes(query);
  });

  return (
    <div className="min-h-screen bg-[var(--bg-body)]">
      <Header theme={theme} onSetTheme={setTheme} title="Live Sheet Records" />
      
      <div className="px-4 lg:px-8 max-w-6xl mx-auto pb-24">
        {!selectedType ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto pt-8"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="w-8 h-8 text-primary-500" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">Spreadsheet Explorer</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-2">Select a laboratory section to view real-time data from Google Sheets.</p>
            </div>
            <SampleTypeSelector onSelect={setSelectedType} />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Top Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass p-4 rounded-2xl border border-[var(--border-subtle)]">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => { setSelectedType(null); setData([]); }}
                  className="p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-secondary)]"
                >
                  &larr;
                </button>
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    {selectedType} Section
                    <span className="px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500 text-[10px] font-bold uppercase tracking-wider">Live</span>
                  </h3>
                  <p className="text-[10px] text-[var(--text-muted)] font-medium">Viewing real-time records from {getSheetTabName(selectedType)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-subtle)] rounded-xl py-2 pl-9 pr-4 text-xs text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
                <button 
                  onClick={() => loadData(selectedType)}
                  disabled={loading || !isOnline}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl text-xs font-bold hover:bg-primary-600 disabled:opacity-50 transition-all shadow-lg shadow-primary-500/20"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Fetching...' : 'Refresh'}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-2xl flex items-start gap-3 text-danger-500">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {!loading && data.length === 0 && !error ? (
              <div className="glass rounded-3xl p-20 text-center border border-[var(--border-subtle)]">
                <div className="w-16 h-16 rounded-full bg-[var(--bg-body)] flex items-center justify-center mx-auto mb-4 border border-[var(--border-subtle)]">
                  <FileSpreadsheet className="w-8 h-8 text-[var(--text-muted)]" />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">No Records Found</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-xs mx-auto">We couldn't find any records for the current month in the {selectedType} sheet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredData.map((row, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="glass rounded-2xl p-5 border border-[var(--border-subtle)] hover:border-primary-500/30 transition-all group relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div>
                        <span className="text-[10px] font-bold text-primary-500 uppercase tracking-widest block mb-1">Control #</span>
                        <h3 className="font-mono font-bold text-[var(--text-primary)] text-sm">{row.control || row.controlnumber || row['CONTROL #'] || 'N/A'}</h3>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(row.status || row['STATUS'])}`}>
                        {row.status || row['STATUS'] || 'Unknown'}
                      </span>
                    </div>

                    <div className="mb-4 relative z-10">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-1">Sample Name</span>
                      <p className="font-bold text-[var(--text-primary)] text-sm group-hover:text-primary-500 transition-colors line-clamp-1">
                        {row.samplename || row.name || row.sampledetails || row.sample || row['SAMPLE NAME'] || '-'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border-subtle)] relative z-10">
                      <div className="space-y-3">
                        <div>
                          <span className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                            <Calendar className="w-3 h-3" /> Collected
                          </span>
                          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                            {row.datecollected || row.datesampled || row.dateswabbed || row.datereceivedsampled || row['DATE COLLECTED'] || row['DATE RECEIVED/SAMPLED'] || '-'}
                            <span className="block text-[10px] text-[var(--text-muted)] font-normal">
                              {row.timecollected || row.timesampled || row.timeswabbed || row.time || row['TIME COLLECTED'] || row['TIME'] || ''}
                            </span>
                          </p>
                        </div>
                        <div>
                          <span className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                            <User className="w-3 h-3" /> Collector
                          </span>
                          <p className="text-[11px] font-semibold text-[var(--text-secondary)] truncate">
                            {row.whocollected || row.collectedby || row.swabbedby || row['WHO COLLECTED'] || '-'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <span className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                            <ClockIcon className="w-3 h-3" /> Analyzed
                          </span>
                          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                            {row.dateanalyzed || row['DATE ANALYZED'] || '-'}
                            <span className="block text-[10px] text-[var(--text-muted)] font-normal">
                              {row.timeanalyzed || row['TIME ANALYZED'] || ''}
                            </span>
                          </p>
                        </div>
                        <div>
                          <span className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                            <CheckCircle2 className="w-3 h-3" /> Analyst
                          </span>
                          <p className="text-[11px] font-semibold text-[var(--text-secondary)] truncate">
                            {row.whoanalyzed || row.analyzedby || row['WHO ANALYZED'] || '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
