import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Key, Shield, AlertCircle, X, Check, Save, Search, ArrowDown, ArrowUp, ArrowRightToLine } from 'lucide-react';
import Header from '../components/Layout/Header';
import Pagination from '../components/ui/Pagination';
import { useTheme } from '../hooks/useTheme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getSettings } from '../utils/auth';
import { updateSheetRow, fetchSheetSchema } from '../utils/api';

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
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sorting: Default to descending order on _rowIndex (latest samples first)
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: '_rowIndex', direction: 'desc' });
  
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
  
  // Frozen columns configuration
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [manualFreezeIndex, setManualFreezeIndex] = useState<number | null>(null); // null means use default behavior

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
      
      const [response, schemaHeaders] = await Promise.all([
        fetch(`/api/sheet-data?sheetId=${settings.spreadsheetId}&tab=${encodeURIComponent(tabId)}`),
        fetchSheetSchema(tabId)
      ]);
      
      if (!response.ok) throw new Error(await response.text());
      const rows = await response.json();
      
      setData(rows || []);
      setHeaders(schemaHeaders.filter(h => h && h.trim() !== ''));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data from Google Sheets.');
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab, loadData]);

  // Measure column widths for sticky positioning
  useEffect(() => {
    if (theadRef.current && headers.length > 0 && data.length > 0) {
      // Need a tiny timeout to allow the browser to paint and calculate widths
      const timer = setTimeout(() => {
        if (!theadRef.current) return;
        const ths = Array.from(theadRef.current.querySelectorAll('th'));
        const newWidths: Record<string, number> = {};
        
        if (ths.length > 0) {
          newWidths['__row'] = (ths[0] as HTMLElement).offsetWidth;
          headers.forEach((col, i) => {
            const th = ths[i + 1]; // +1 because index 0 is Row
            if (th) newWidths[col] = (th as HTMLElement).offsetWidth;
          });
          setColWidths(newWidths);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [headers, data, currentPage, sortConfig]);

  // Reset page when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

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

      const controlCol = Object.keys(rowToEdit).find(k => k.toUpperCase().includes('CONTROL'));
      const controlNumber = controlCol ? rowToEdit[controlCol] : '';

      const updatePayload = {
        _rowIndex: id,
        [field]: editValue
      };

      const result = await updateSheetRow(activeTab, controlNumber, updatePayload);
      
      if (!result.success) throw new Error(result.error);
      
      setData(prev => prev.map(row => String(row._rowIndex) === String(id) ? { ...row, [field]: editValue } : row));
      setEditingCell(null);
    } catch (err: any) {
      alert(`Error saving: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      // Third click: remove sorting, revert to default _rowIndex desc
      setSortConfig({ key: '_rowIndex', direction: 'desc' });
      return;
    }
    setSortConfig({ key, direction });
  };

  const filteredData = useMemo(() => {
    return data.filter(row => {
      const query = searchQuery.toLowerCase();
      const rowValues = Object.values(row)
        .filter(v => typeof v === 'string' || typeof v === 'number')
        .join(' ')
        .toLowerCase();
      return rowValues.includes(query);
    });
  }, [data, searchQuery]);

  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        
        if (!isNaN(Number(aVal)) && !isNaN(Number(bVal)) && aVal !== '' && bVal !== '') {
          aVal = Number(aVal);
          bVal = Number(bVal);
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage]);

  const dynamicColumns = useMemo(() => headers, [headers]);

  // Determine if a column should be frozen based on default criteria or manual override
  const getIsFrozen = useCallback((colName: string, index: number) => {
    if (manualFreezeIndex !== null) return index <= manualFreezeIndex;
    const upper = colName.toUpperCase();
    return upper.includes('CONTROL') || upper.includes('BATCH') || upper.includes('SAMPLE');
  }, [manualFreezeIndex]);

  // Calculate the left offsets for sticky positioning
  const frozenLeftOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let currentLeft = 0;
    
    offsets['__row'] = currentLeft;
    currentLeft += colWidths['__row'] || 0; // if 0, it means not measured yet

    headers.forEach((col, index) => {
      if (getIsFrozen(col, index)) {
        offsets[col] = currentLeft;
        currentLeft += colWidths[col] || 0;
      }
    });
    return offsets;
  }, [headers, colWidths, getIsFrozen]);

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
            
            {/* Freeze columns slider/adjuster */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)]" title="Adjust frozen columns">
              <ArrowRightToLine className="w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="range"
                min="0"
                max={dynamicColumns.length}
                value={manualFreezeIndex !== null ? manualFreezeIndex + 1 : -1}
                onChange={e => {
                  const val = parseInt(e.target.value, 10);
                  if (val === -1) setManualFreezeIndex(null); // Return to default
                  else setManualFreezeIndex(val - 1);
                }}
                className="w-24 accent-primary-500"
              />
              <span className="text-[10px] font-bold text-[var(--text-muted)] whitespace-nowrap w-4 text-center">
                {manualFreezeIndex !== null ? manualFreezeIndex + 1 : 'Auto'}
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search any field..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full lg:w-48 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl py-2 pl-9 pr-4 text-xs text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors"
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
              <thead ref={theadRef} className="sticky top-0 z-30 shadow-sm after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:border-b after:border-[var(--border-subtle)]">
                <tr>
                  <th 
                    className="px-3 py-2 font-bold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-card)] border-r border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors select-none"
                    style={{ position: 'sticky', left: frozenLeftOffsets['__row'], zIndex: 30 }}
                    onClick={() => handleSort('_rowIndex')}
                  >
                    <div className="flex items-center justify-between">
                      <span>Row</span>
                      {sortConfig.key === '_rowIndex' && (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  {dynamicColumns.map((col, index) => {
                    const frozen = getIsFrozen(col, index);
                    return (
                      <th 
                        key={col} 
                        className="px-4 py-3 font-bold text-[var(--text-secondary)] uppercase tracking-wider bg-[var(--bg-card)] border-r border-[var(--border-subtle)] max-w-[200px] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors select-none" 
                        title={col}
                        style={frozen ? { position: 'sticky', left: frozenLeftOffsets[col], zIndex: 30 } : {}}
                        onClick={() => handleSort(col)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{col}</span>
                          {sortConfig.key === col && (
                            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 shrink-0" /> : <ArrowDown className="w-3 h-3 shrink-0" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-primary)] bg-[var(--bg-app)] relative z-0">
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
                      
                      <td 
                        className="px-3 py-2 border-r border-[var(--border-subtle)] text-[var(--text-muted)] font-mono text-[10px] bg-[var(--bg-card)]/95 backdrop-blur-sm"
                        style={{ position: 'sticky', left: frozenLeftOffsets['__row'], zIndex: 10 }}
                      >
                        {row._rowIndex}
                      </td>

                      {/* Dynamic Columns */}
                      {dynamicColumns.map((col, index) => {
                        const cellValue = row[col] || '';
                        const isEditingThis = editingCell?.id === String(row._rowIndex) && editingCell?.field === col;
                        const frozen = getIsFrozen(col, index);
                        
                        return (
                          <td 
                            key={col}
                            className={`px-4 py-2 border-r border-[var(--border-subtle)] cursor-cell relative max-w-[250px] ${isEditingThis ? 'p-0' : ''} ${frozen ? 'bg-[var(--bg-card)]/95 backdrop-blur-sm' : ''}`}
                            style={frozen ? { position: 'sticky', left: frozenLeftOffsets[col], zIndex: 10 } : {}}
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
