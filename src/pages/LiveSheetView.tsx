import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Key, Shield, AlertCircle, X, Check, Save, Search } from 'lucide-react';
import Header from '../components/Layout/Header';
import Pagination from '../components/ui/Pagination';
import { useTheme } from '../hooks/useTheme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getSettings } from '../utils/auth';
import { updateSheetRow } from '../utils/api';

// 5 minutes in milliseconds
const PASSWORD_VALIDITY_MS = 5 * 60 * 1000;
const EDITOR_PASSWORD = 'admin'; // Default password

const TABS = [
  { id: 'SWAB 2026', label: 'ENVI 2026' },
  { id: 'WATER 2026', label: 'WATER 2026' },
  { id: 'RM,FG,SFG 2026', label: 'RM,SFG,FG 2026' },
  { id: 'AIR 2026', label: 'AIR 2026' }
];

export default function LiveSheetView() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  
  const [passwordPromptVisible, setPasswordPromptVisible] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [lastAuthTime, setLastAuthTime] = useState<number>(() => {
    const saved = localStorage.getItem('supabaseEditorAuthTime');
    return saved ? parseInt(saved, 10) : 0;
  });
  
  const [editingCell, setEditingCell] = useState<{ id: string, field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingId, setSavingId] = useState<string | null>(null);
  
  const isOnline = useOnlineStatus();

  const loadData = useCallback(async (tabId: string) => {
    if (!isOnline) {
      setError('You are currently offline.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const settings = getSettings();
      if (!settings.spreadsheetId) {
        throw new Error('Google Spreadsheet ID is not configured in Settings.');
      }
      
      const response = await fetch(`/api/sheet-data?sheetId=${settings.spreadsheetId}&tab=${encodeURIComponent(tabId)}`);
      if (!response.ok) throw new Error(await response.text());
      const rows = await response.json();
      setData(rows || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data from Google Sheets.');
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab, loadData]);

  // Reset page when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  // Cleanup auth on interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastAuthTime > 0 && Date.now() - lastAuthTime > PASSWORD_VALIDITY_MS) {
        setLastAuthTime(0);
        localStorage.removeItem('supabaseEditorAuthTime');
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [lastAuthTime]);

  const handleCellDoubleClick = (id: string, field: string, currentValue: any) => {
    if (Date.now() - lastAuthTime < PASSWORD_VALIDITY_MS) {
      setEditValue(String(currentValue || ''));
      setEditingCell({ id, field });
    } else {
      setPasswordPromptVisible(true);
      setPasswordError('');
      setPasswordInput('');
    }
  };

  const submitPassword = () => {
    if (passwordInput === EDITOR_PASSWORD) {
      const now = Date.now();
      setLastAuthTime(now);
      localStorage.setItem('supabaseEditorAuthTime', now.toString());
      setPasswordPromptVisible(false);
    } else {
      setPasswordError('Invalid password');
    }
  };

  const saveCellEdit = async () => {
    if (!editingCell) return;
    
    // Check auth again
    if (Date.now() - lastAuthTime > PASSWORD_VALIDITY_MS) {
      setEditingCell(null);
      setPasswordPromptVisible(true);
      return;
    }

    const { id, field } = editingCell;
    setSavingId(id);
    
    try {
      const rowToEdit = data.find(r => String(r._rowIndex) === String(id));
      if (!rowToEdit) throw new Error('Row not found');

      // Find the control number column dynamically
      const controlCol = Object.keys(rowToEdit).find(k => k.toUpperCase().includes('CONTROL'));
      const controlNumber = controlCol ? rowToEdit[controlCol] : '';

      const updatePayload = {
        _rowIndex: id, // api/submit uses _rowIndex to precisely target the Google Sheet row
        [field]: editValue
      };

      const result = await updateSheetRow(activeTab, controlNumber, updatePayload);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // Update local state
      setData(prev => prev.map(row => String(row._rowIndex) === String(id) ? { ...row, [field]: editValue } : row));
      setEditingCell(null);
    } catch (err: any) {
      alert(`Error saving: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(row => {
      const query = searchQuery.toLowerCase();
      // search across all values in the row
      const rowValues = Object.values(row)
        .filter(v => typeof v === 'string' || typeof v === 'number')
        .join(' ')
        .toLowerCase();
      return rowValues.includes(query);
    });
  }, [data, searchQuery]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, currentPage, rowsPerPage]);

  // Extract columns directly from Google Sheet data
  const dynamicColumns = useMemo(() => {
    const keys = new Set<string>();
    data.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key !== '_rowIndex' && key !== '__rawRow') {
          keys.add(key);
        }
      });
    });
    return Array.from(keys);
  }, [data]);

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <Header theme={theme} onSetTheme={setTheme} title="Live Data Editor" />
      
      <div className="px-4 lg:px-8 max-w-full mx-auto flex-1 flex flex-col pb-8 pt-4 space-y-4 overflow-hidden">
        
        {/* Tabs & Controls Bar */}
        <div className="glass p-3 rounded-2xl border border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === tab.id 
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' 
                    : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search any field..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full lg:w-64 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl py-2 pl-9 pr-4 text-xs text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
            <button 
              onClick={() => loadData(activeTab)}
              className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-xl text-xs font-bold transition-all"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            {Date.now() - lastAuthTime < PASSWORD_VALIDITY_MS && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-primary-500/10 text-primary-500 rounded-xl text-xs font-bold border border-primary-500/20 whitespace-nowrap">
                <Key className="w-3.5 h-3.5" /> Editor Active
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-2xl flex items-start gap-3 text-danger-500 shrink-0">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Spreadsheet Data Grid */}
        <div className="flex-1 glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden flex flex-col relative min-h-0">
          <div className="flex-1 overflow-auto relative custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-[var(--bg-card)] shadow-sm after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:border-b after:border-[var(--border-subtle)]">
                <tr>
                  <th className="px-3 py-2 font-bold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-card)] border-r border-[var(--border-subtle)]">
                    Row
                  </th>
                  {dynamicColumns.map(col => (
                    <th key={col} className="px-4 py-3 font-bold text-[var(--text-secondary)] uppercase tracking-wider bg-[var(--bg-card)] border-r border-[var(--border-subtle)] max-w-[200px] truncate" title={col}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-primary)] bg-[var(--bg-app)]">
                {loading && data.length === 0 ? (
                  <tr>
                    <td colSpan={dynamicColumns.length + 1} className="px-4 py-12 text-center text-[var(--text-muted)]">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-primary-500" />
                      <p className="font-medium">Loading Google Sheets data...</p>
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={dynamicColumns.length + 1} className="px-4 py-12 text-center">
                      <p className="font-medium text-[var(--text-secondary)]">No records found.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row) => (
                    <tr key={row._rowIndex} className="hover:bg-[var(--bg-hover)] transition-colors group">
                      
                      <td className="px-3 py-2 border-r border-[var(--border-subtle)] text-[var(--text-muted)] font-mono text-[10px] bg-[var(--bg-card)]/50">
                        {row._rowIndex}
                      </td>

                      {/* Dynamic Columns */}
                      {dynamicColumns.map(col => {
                        const cellValue = row[col] || '';
                        const isEditingThis = editingCell?.id === String(row._rowIndex) && editingCell?.field === col;
                        return (
                          <td 
                            key={col}
                            className={`px-4 py-2 border-r border-[var(--border-subtle)] cursor-cell relative max-w-[250px] ${isEditingThis ? 'p-0' : ''}`}
                            onDoubleClick={() => handleCellDoubleClick(String(row._rowIndex), col, cellValue)}
                          >
                            {isEditingThis ? (
                              <input 
                                autoFocus
                                className="w-full h-full min-h-[36px] bg-[var(--bg-input)] text-[var(--text-primary)] px-4 py-2 outline-none border-2 border-primary-500 text-xs font-mono"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={saveCellEdit}
                                onKeyDown={e => { if (e.key === 'Enter') saveCellEdit(); else if (e.key === 'Escape') setEditingCell(null); }}
                              />
                            ) : (
                              <span className="truncate block" title={String(cellValue)}>{String(cellValue)}</span>
                            )}
                            {savingId === String(row._rowIndex) && editingCell?.field === col && <RefreshCw className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-primary-500" />}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <Pagination
            currentPage={currentPage}
            totalRows={filteredData.length}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* Password Prompt Modal */}
      <AnimatePresence>
        {passwordPromptVisible && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl shadow-xl max-w-sm w-full overflow-hidden"
            >
              <div className="p-5 border-b border-[var(--border-subtle)] flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center shrink-0">
                  <Shield className="w-6 h-6 text-primary-500" />
                </div>
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] text-lg">Authentication</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Enter password to edit live data</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {passwordError && (
                  <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-500 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {passwordError}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Editor Password</label>
                  <input
                    type="password"
                    autoFocus
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitPassword()}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="Enter password..."
                  />
                  <p className="text-[10px] text-[var(--text-muted)] font-medium">Session remains active for 5 minutes.</p>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button 
                    onClick={() => setPasswordPromptVisible(false)}
                    className="flex-1 px-4 py-2.5 text-xs font-bold text-[var(--text-secondary)] bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={submitPassword}
                    className="flex-1 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-primary-500/20 transition-all flex justify-center items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Authenticate
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
