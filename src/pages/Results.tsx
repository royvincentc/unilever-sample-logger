import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileSpreadsheet, RefreshCw, AlertCircle, Search, Edit2, X, Save, FileText
} from 'lucide-react';
import Header from '../components/Layout/Header';
import { fetchLiveSheetData } from '../utils/api';
import { updateSheetRow } from '../utils/api';
import { getSheetTabName } from '../utils/sheetMapping';
import { useTheme } from '../hooks/useTheme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useToast } from '../components/ui/Toast';
import type { SampleType } from '../types';
import Button from '../components/ui/Button';
import { generateDocxReport } from '../utils/report';

type TabOption = 'ENVI' | 'WATER' | 'RawMats' | 'AIR';

const TABS: { id: TabOption; label: string }[] = [
  { id: 'ENVI', label: 'SWAB 2026' },
  { id: 'WATER', label: 'WATER 2026' },
  { id: 'RawMats', label: 'RM,FG,SFG 2026' },
  { id: 'AIR', label: 'AIR 2026' },
];

export default function Results() {
  const { theme, setTheme } = useTheme();
  const [selectedTab, setSelectedTab] = useState<TabOption>('ENVI');
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const isOnline = useOnlineStatus();
  const { showToast } = useToast();

  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerateReport = async (row: any) => {
    try {
      showToast('info', 'Generating report...');
      await generateDocxReport(row, '', selectedTab);
      showToast('success', 'Report downloaded successfully!');
    } catch (err: any) {
      console.error(err);
      showToast('error', err.message || 'Failed to generate report');
    }
  };

  useEffect(() => {
    loadData(selectedTab);
  }, [selectedTab]);

  const loadData = async (type: TabOption) => {
    if (!isOnline) {
      setError('You are currently offline.');
      return;
    }

    setLoading(true);
    setError(null);
    setData([]);
    setHeaders([]);
    
    try {
      const sheetTab = getSheetTabName(type as SampleType);
      const rows = await fetchLiveSheetData(sheetTab);
      
      if (rows && rows.length > 0) {
        // Find the longest object to extract all possible headers
        let allHeaders: string[] = [];
        for (const row of rows) {
          const keys = Object.keys(row);
          if (keys.length > allHeaders.length) {
            allHeaders = keys;
          }
        }
        setHeaders(allHeaders);
        setData(rows);
      } else {
        setData([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data from the live sheet.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (row: any) => {
    setEditingRow(row);
    setEditForm({ ...row });
  };

  const handleSaveEdit = async () => {
    if (!editingRow) return;
    
    const controlNumber = editingRow['CONTROL #'] || editingRow['CONTROL'] || editingRow['CONTROLNUMBER'] || editingRow['SAMPLE ID'] || editingRow['CUC'];
    
    if (!controlNumber) {
      showToast('error', 'Update Failed', 'Could not find a Control Number for this row.');
      return;
    }

    setIsSaving(true);
    try {
      const sheetTab = getSheetTabName(selectedTab as SampleType);
      // We only send the changes? Or we can send the whole row.
      // updateSheetRow matches the exact header names and updates them.
      const res = await updateSheetRow(sheetTab, controlNumber, editForm);
      if (res.success) {
        showToast('success', 'Row Updated', 'Changes saved to Google Sheets.');
        setEditingRow(null);
        loadData(selectedTab);
      } else {
        throw new Error(res.error || 'Unknown API Error');
      }
    } catch (err: any) {
      showToast('error', 'Update Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredData = data.filter(row => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    // Search across all values in the row
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-[var(--bg-body)] flex flex-col">
      <Header theme={theme} onSetTheme={setTheme} title="Live Results Dashboard" />
      
      <div className="flex-1 px-4 lg:px-8 py-6 max-w-[1600px] mx-auto w-full flex flex-col">
        
        {/* Tab Navigation (Matching Screenshot) */}
        <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-[var(--border-subtle)] pb-4">
          {TABS.map(tab => {
            const isActive = selectedTab === tab.id;
            let tabColorClass = 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]';
            let indicatorColor = 'bg-transparent';
            
            if (isActive) {
              if (tab.id === 'ENVI') {
                tabColorClass = 'text-green-500 font-bold bg-green-500/10';
                indicatorColor = 'bg-green-500';
              } else if (tab.id === 'WATER') {
                tabColorClass = 'text-blue-500 font-bold bg-blue-500/10';
                indicatorColor = 'bg-blue-500';
              } else if (tab.id === 'RawMats') {
                tabColorClass = 'text-pink-500 font-bold bg-pink-500/10';
                indicatorColor = 'bg-pink-500';
              } else if (tab.id === 'AIR') {
                tabColorClass = 'text-yellow-500 font-bold bg-yellow-500/10';
                indicatorColor = 'bg-yellow-500';
              }
            }
            
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`relative px-5 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 ${tabColorClass}`}
              >
                {tab.label}
                {isActive && (
                  <motion.div 
                    layoutId="activeTabIndicator"
                    className={`absolute bottom-[-17px] left-0 right-0 h-1 ${indicatorColor}`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Warning Note */}
        <div className="mb-6 px-4 py-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          <span><strong>Note:</strong> Generate Automated File Report for Swab 2026, Water 2026, and AIR 2026 is under construction.</span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search any column..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl py-2.5 pl-9 pr-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
          
          <button 
            onClick={() => loadData(selectedTab)}
            disabled={loading || !isOnline}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-xl text-sm font-bold hover:bg-[var(--bg-hover)] disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Syncing...' : 'Sync Sheet'}
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-danger-500/10 border border-danger-500/20 rounded-2xl flex items-start gap-3 text-danger-500">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Data Grid */}
        <div className="flex-1 glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-[var(--text-muted)]">
              <RefreshCw className="w-8 h-8 animate-spin mb-4 text-primary-500" />
              <p>Fetching live records...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-[var(--text-muted)] text-center">
              <FileSpreadsheet className="w-12 h-12 mb-4 opacity-50" />
              <h3 className="text-lg font-bold text-[var(--text-primary)]">No Records Found</h3>
              <p className="text-sm mt-1">There are no records in the {getSheetTabName(selectedTab as SampleType)} sheet, or they don't match your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-left border-collapse text-sm min-w-max">
                <thead className="sticky top-0 bg-[var(--bg-surface)] z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">Actions</th>
                    {headers.map((h, i) => (
                      <th key={i} className="px-4 py-3 font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] uppercase tracking-wider text-xs">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filteredData.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-[var(--bg-hover)] transition-colors group">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditClick(row)}
                            className="p-1.5 rounded-lg bg-[var(--bg-body)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-primary-500 hover:border-primary-500 transition-colors shadow-sm"
                            title="Edit Row"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleGenerateReport(row)}
                            className="p-1.5 rounded-lg bg-[var(--bg-body)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-success-500 hover:border-success-500 transition-colors shadow-sm"
                            title="Generate Report"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      {headers.map((h, colIndex) => (
                        <td key={colIndex} className="px-4 py-3 text-[var(--text-primary)] max-w-xs truncate">
                          {row[h] !== undefined && row[h] !== null ? String(row[h]) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingRow(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-body)]">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Edit Record</h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Editing row: {editingRow['CONTROL #'] || editingRow['CONTROL'] || 'Unknown'}
                  </p>
                </div>
                <button
                  onClick={() => setEditingRow(null)}
                  className="p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
                {headers.map((h, i) => {
                  const upperH = h.toUpperCase();
                  
                  const isReadOnly = (() => {
                    if (upperH.includes('CONTROL') || upperH === 'TIMESTAMP') return true;

                    if (selectedTab === 'RawMats') {
                      const editablePatterns = [
                        'AEROBIC PLATE COUNT',
                        'GRAM- NEGATIVE',
                        'GRAM - NEGATIVE',
                        'YEAST AND MOLDS',
                        'TSA',
                        'SDA',
                        'MCA',
                        'REMARKS'
                      ];
                      if (editablePatterns.some(pattern => upperH.includes(pattern))) return false;
                      return true;
                    }

                    if (selectedTab === 'ENVI') {
                      const editablePatterns = [
                        'TVC (COUNT)',
                        'GRAM STAINING'
                      ];
                      if (editablePatterns.some(pattern => upperH.includes(pattern))) return false;
                      return true;
                    }

                    if (selectedTab === 'WATER') {
                      const editablePatterns = [
                        'TVC (COUNT)',
                        'GRAM NEGATIVE (COUNT)',
                        'REMARKS'
                      ];
                      if (editablePatterns.some(pattern => upperH.includes(pattern))) return false;
                      return true;
                    }

                    if (selectedTab === 'AIR') {
                      const editablePatterns = [
                        'TVC (COUNT)',
                        'REMARKS'
                      ];
                      if (editablePatterns.some(pattern => upperH.includes(pattern))) return false;
                      return true;
                    }
                    
                    return false;
                  })();

                  const isHidden = (() => {
                    // We only want to hide fields on RawMats, ENVI, WATER, and AIR
                    // (which is all of them, so we just return false if it's not one of these, but they are the only tabs)
                    
                    // Hide all read-only fields except CONTROL and SAMPLE for context
                    if (isReadOnly && !upperH.includes('CONTROL') && !upperH.includes('SAMPLE') && !upperH.includes('POINT')) {
                      return true;
                    }
                    return false;
                  })();

                  if (isHidden) return null;

                  return (
                    <div key={i} className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">
                        {h} {isReadOnly && '(Read-Only)'}
                      </label>
                      <input
                        type="text"
                        value={editForm[h] || ''}
                        onChange={(e) => setEditForm({ ...editForm, [h]: e.target.value })}
                        disabled={isReadOnly}
                        className={`w-full px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm transition-colors
                          ${isReadOnly 
                            ? 'bg-[var(--bg-body)] text-[var(--text-muted)] cursor-not-allowed' 
                            : 'bg-[var(--bg-input)] text-[var(--text-primary)] focus:border-primary-500 focus:ring-1 focus:ring-primary-500'
                          }`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-body)] flex justify-end gap-3">
                <button
                  onClick={() => setEditingRow(null)}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  Cancel
                </button>
                <Button
                  onClick={handleSaveEdit}
                  loading={isSaving}
                  icon={<Save className="w-4 h-4" />}
                  className="px-8 py-2.5 rounded-xl font-bold bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/20"
                >
                  Save to Sheet
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
