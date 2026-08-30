import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Key, Shield, AlertCircle, X, Check, Save, Search, ArrowDown, ArrowUp, Columns, Pin, Eye, EyeOff } from 'lucide-react';
import Header from '../components/Layout/Header';
import Pagination from '../components/ui/Pagination';
import { useTheme } from '../hooks/useTheme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getSettings } from '../utils/auth';
import { updateSheetRow, fetchSheetSchema } from '../utils/api';
import { listenToLiveSheetSettings, saveLiveSheetSettings } from '../utils/db';

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
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  
  // Column Settings
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set());
  const [showColumnHider, setShowColumnHider] = useState(false);

  // Sync settings with Firebase
  useEffect(() => {
    const unsubscribe = listenToLiveSheetSettings(activeTab, (settings) => {
      if (settings) {
        setHiddenColumns(new Set(settings.hiddenColumns || []));
        setFrozenColumns(new Set(settings.frozenColumns || []));
      } else {
        setHiddenColumns(new Set());
        // Default freeze logic if no settings found
        const defaults = new Set<string>();
        if (activeTab === 'SWAB 2026') { defaults.add('CONTROL #'); defaults.add('SAMPLE'); }
        else if (activeTab === 'WATER 2026') { defaults.add('CONTROL #'); defaults.add('WATER SOURCE'); }
        else if (activeTab === 'RM,FG,SFG 2026') { defaults.add('CONTROL #'); defaults.add('BATCH #'); }
        else { defaults.add('CONTROL #'); }
        setFrozenColumns(defaults);
      }
    });
    return () => unsubscribe();
  }, [activeTab]);

  const toggleColumnSetting = async (col: string, type: 'hidden' | 'frozen') => {
    let newHidden = new Set(hiddenColumns);
    let newFrozen = new Set(frozenColumns);

    if (type === 'hidden') {
      if (newHidden.has(col)) newHidden.delete(col);
      else newHidden.add(col);
      setHiddenColumns(newHidden); // Optimistic UI
    } else {
      if (newFrozen.has(col)) newFrozen.delete(col);
      else newFrozen.add(col);
      setFrozenColumns(newFrozen); // Optimistic UI
    }

    try {
      await saveLiveSheetSettings(activeTab, {
        hiddenColumns: Array.from(newHidden),
        frozenColumns: Array.from(newFrozen)
      });
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  };

  // Frozen columns configuration
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

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
      const timer = setTimeout(() => {
        if (!theadRef.current) return;
        const ths = Array.from(theadRef.current.querySelectorAll('th'));
        const newWidths: Record<string, number> = {};
        
        if (ths.length > 0) {
          newWidths['__row'] = (ths[0] as HTMLElement).offsetWidth;
          // Note: visibleColumns should be mapped carefully. Since we only render visible columns, 
          // ths[1] corresponds to visibleColumns[0].
          let thIndex = 1;
          headers.forEach((col) => {
            if (!hiddenColumns.has(col)) {
              const th = ths[thIndex];
              if (th) newWidths[col] = (th as HTMLElement).offsetWidth;
              thIndex++;
            }
          });
          setColWidths(newWidths);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [headers, data, currentPage, sortConfig, hiddenColumns]);

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

  const dynamicColumns = useMemo(() => headers.filter(h => !hiddenColumns.has(h)), [headers, hiddenColumns]);

  const frozenLeftOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let currentLeft = 0;
    
    offsets['__row'] = currentLeft;
    currentLeft += colWidths['__row'] || 0; 

    dynamicColumns.forEach((col) => {
      if (frozenColumns.has(col)) {
        offsets[col] = currentLeft;
        currentLeft += colWidths[col] || 0;
      }
    });
    return offsets;
  }, [dynamicColumns, colWidths, frozenColumns]);

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <Header theme={theme} onSetTheme={setTheme} title="Live Data Editor" />
      
      <div className="px-4 lg:px-8 max-w-full mx-auto flex-1 flex flex-col pb-8 pt-4 space-y-4">
        
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
                    : 'bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            
            {/* Columns Hide/Unhide */}
            <div className="relative hidden lg:block">
              <button
                onClick={() => setShowColumnHider(!showColumnHider)}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] rounded-xl text-xs font-bold text-[var(--text-primary)] transition-colors"
                title="Hide or unhide columns"
              >
                <Columns className="w-4 h-4 text-[var(--text-muted)]" />
                Columns
              </button>
              
              <AnimatePresence>
                {showColumnHider && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowColumnHider(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl shadow-xl z-50 overflow-hidden flex flex-col"
                    >
                      <div className="p-3 border-b border-[var(--border-subtle)]">
                        <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Column Settings</h4>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
                        {headers.map(col => (
                          <div key={col} className="flex items-center justify-between px-2 py-1.5 hover:bg-[var(--bg-hover)] rounded-lg">
                            <span className="text-xs font-medium text-[var(--text-secondary)] truncate mr-2" title={col}>{col}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <label className="flex items-center gap-1 cursor-pointer" title="Freeze Column">
                                <Pin className={`w-3.5 h-3.5 ${frozenColumns.has(col) ? 'text-primary-500' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`} />
                                <input
                                  type="checkbox"
                                  checked={frozenColumns.has(col)}
                                  onChange={() => toggleColumnSetting(col, 'frozen')}
                                  className="sr-only"
                                />
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer" title="Visible Column">
                                {hiddenColumns.has(col) ? (
                                  <EyeOff className="w-3.5 h-3.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5 text-primary-500" />
                                )}
                                <input
                                  type="checkbox"
                                  checked={!hiddenColumns.has(col)}
                                  onChange={() => toggleColumnSetting(col, 'hidden')}
                                  className="sr-only"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
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
        <div className="glass rounded-2xl border border-[var(--border-subtle)] flex flex-col relative w-full overflow-x-auto overflow-y-clip custom-scrollbar mb-6">
          
          {/* MOBILE CARD VIEW (< lg) */}
          <div className="p-4 lg:hidden space-y-4">
            {loading && data.length === 0 ? (
               <div className="py-12 text-center text-[var(--text-muted)]">
                 <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-primary-500" />
                 <p className="font-medium">Loading Google Sheets data...</p>
               </div>
            ) : paginatedData.length === 0 ? (
               <div className="py-12 text-center">
                 <p className="font-medium text-[var(--text-secondary)]">No records found.</p>
               </div>
            ) : (
              paginatedData.map((row) => {
                const isExpanded = expandedCardId === String(row._rowIndex);
                const controlCol = Object.keys(row).find(k => k.toUpperCase().includes('CONTROL'));
                const controlNumber = controlCol ? row[controlCol] : `Row ${row._rowIndex}`;
                
                // Fields to show when expanded (non-empty)
                const visibleFields = dynamicColumns.filter(col => row[col] && String(row[col]).trim() !== '');

                return (
                  <div 
                    key={row._rowIndex} 
                    className={`bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden transition-all duration-200 ${isExpanded ? 'ring-2 ring-primary-500 shadow-lg' : 'shadow-sm'}`}
                  >
                    <div 
                      className="p-4 cursor-pointer flex items-center justify-between bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-hover)]"
                      onClick={() => setExpandedCardId(isExpanded ? null : String(row._rowIndex))}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-primary-500 bg-primary-500/10 px-2 py-1 rounded">
                          #{row._rowIndex}
                        </span>
                        <span className="font-bold text-sm text-[var(--text-primary)]">
                          {controlNumber}
                        </span>
                      </div>
                      <div>
                        {isExpanded ? <ArrowUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ArrowDown className="w-4 h-4 text-[var(--text-muted)]" />}
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-[var(--border-subtle)] bg-[var(--bg-app)]/50 overflow-hidden"
                        >
                          <div className="p-4 grid grid-cols-1 gap-y-3">
                            {visibleFields.map(col => {
                              const cellValue = row[col];
                              const isEditingThis = editingCell?.id === String(row._rowIndex) && editingCell?.field === col;
                              
                              return (
                                <div key={col} className="flex flex-col">
                                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">{col}</span>
                                  {isEditingThis ? (
                                    <div className="relative">
                                      <input 
                                        autoFocus
                                        className="w-full bg-[var(--bg-input)] text-[var(--text-primary)] px-3 py-2 rounded-lg outline-none border-2 border-primary-500 text-sm font-medium"
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onBlur={saveCellEdit}
                                        onKeyDown={e => { if (e.key === 'Enter') saveCellEdit(); else if (e.key === 'Escape') setEditingCell(null); }}
                                      />
                                      {savingId === String(row._rowIndex) && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary-500" />}
                                    </div>
                                  ) : (
                                    <div 
                                      className="text-sm font-medium text-[var(--text-primary)] break-words cursor-pointer p-1.5 -ml-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors active:bg-[var(--bg-hover)]"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCellDoubleClick(String(row._rowIndex), col, cellValue);
                                      }}
                                    >
                                      {String(cellValue)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>

          {/* DESKTOP TABLE VIEW (>= lg) */}
          <div className="hidden lg:block w-full min-w-max relative">
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
                  {dynamicColumns.map((col) => {
                    const frozen = frozenColumns.has(col);
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
                  paginatedData.map((row) => {
                    const isSelected = expandedCardId === String(row._rowIndex);
                    return (
                      <tr 
                        key={row._rowIndex} 
                        onClick={() => setExpandedCardId(isSelected ? null : String(row._rowIndex))}
                        className={`transition-colors group cursor-pointer ${isSelected ? 'bg-[var(--bg-selected)] outline outline-2 outline-primary-500 relative z-10' : 'hover:bg-[var(--bg-hover)]'}`}
                      >
                        
                        <td 
                          className={`px-3 py-2 border-r border-[var(--border-subtle)] text-[var(--text-muted)] font-mono text-[10px] backdrop-blur-sm ${isSelected ? 'bg-[var(--bg-selected)]' : 'bg-[var(--bg-card)]/95'}`}
                          style={{ position: 'sticky', left: frozenLeftOffsets['__row'], zIndex: 10 }}
                        >
                          {row._rowIndex}
                        </td>

                        {/* Dynamic Columns */}
                        {dynamicColumns.map((col) => {
                          const cellValue = row[col] || '';
                          const isEditingThis = editingCell?.id === String(row._rowIndex) && editingCell?.field === col;
                          const frozen = frozenColumns.has(col);
                          
                          let cellBg = '';
                          if (frozen) {
                            cellBg = isSelected ? 'bg-[var(--bg-selected)]' : 'bg-[var(--bg-card)]/95 backdrop-blur-sm';
                          } else {
                            cellBg = isSelected ? 'bg-[var(--bg-selected)]' : '';
                          }
                          
                          return (
                            <td 
                              key={col}
                              className={`px-4 py-2 border-r border-[var(--border-subtle)] cursor-cell relative max-w-[250px] ${isEditingThis ? 'p-0' : ''} ${cellBg}`}
                              style={frozen ? { position: 'sticky', left: frozenLeftOffsets[col], zIndex: 10 } : {}}
                              onDoubleClick={(e) => { e.stopPropagation(); handleCellDoubleClick(String(row._rowIndex), col, cellValue); }}
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
                    );
                  })
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
