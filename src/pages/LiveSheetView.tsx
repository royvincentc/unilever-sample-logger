import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, RefreshCw, AlertCircle } from 'lucide-react';
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
  const isOnline = useOnlineStatus();

  const loadData = useCallback(async (type: SampleType) => {
    if (!isOnline) {
      setError('You are currently offline.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const sheetTab = getSheetTabName(todayStr, type);
      const rows = await fetchLiveSheetData(sheetTab);
      setData(rows);
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

  return (
    <div>
      <Header theme={theme} onSetTheme={setTheme} title="Live Sheet" />
      <div className="px-4 lg:px-8 max-w-3xl pb-24">
        {!selectedType ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm text-[var(--text-secondary)] mb-6">Select a category to view live records from Google Sheets.</p>
            <SampleTypeSelector onSelect={setSelectedType} />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-center justify-between mb-6">
              <button 
                onClick={() => setSelectedType(null)}
                className="text-sm text-primary-500 font-medium hover:underline cursor-pointer"
              >
                &larr; Change Category
              </button>
              <button 
                onClick={() => loadData(selectedType)}
                disabled={loading || !isOnline}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-3 text-danger-500">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {!loading && data.length === 0 && !error ? (
              <div className="glass rounded-2xl p-12 text-center">
                <FileSpreadsheet className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                <p className="text-sm text-[var(--text-secondary)]">No records found for the current month.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.map((row, index) => (
                  <div key={index} className="glass rounded-xl p-4 border border-[var(--border-subtle)] overflow-hidden">
                    <div className="flex justify-between items-start mb-3 border-b border-[var(--border-subtle)] pb-2">
                      <h3 className="font-bold text-[var(--text-primary)] text-sm truncate max-w-[70%]">{row['CONTROL #'] || 'N/A'}</h3>
                      <span className="text-xs bg-[var(--bg-input)] px-2 py-1 rounded-md text-[var(--text-secondary)] border border-[var(--border-subtle)] truncate max-w-[30%]">
                        {row['STATUS'] || 'N/A'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                      {Object.entries(row).filter(([key]) => !['CONTROL #', 'STATUS', 'row_number'].includes(key)).slice(0, 6).map(([key, value]) => (
                        <div key={key} className="min-w-0">
                          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider truncate" title={key}>{key}</p>
                          <p className="font-medium text-[var(--text-primary)] truncate" title={String(value) || '-'}>{String(value) || '-'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
