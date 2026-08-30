import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, RefreshCw, AlertCircle, Search, ArrowUp, ArrowDown, ArrowUpDown, Eye, EyeOff, GripVertical } from 'lucide-react';
import Header from '../components/Layout/Header';
import CustomSelect from '../components/ui/CustomSelect';
import MultiSelect from '../components/ui/MultiSelect';
import { fetchLiveSheetData } from '../utils/api';
import Pagination from '../components/ui/Pagination';
import { useTheme } from '../hooks/useTheme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useStickyHeader } from '../hooks/useStickyHeader';
import { listenToLogbookSettings, saveLogbookSettings } from '../utils/db';


function getRowControl(row: any): string {
  if (!row) return '';
  const knownKeys = ['CONTROL #', 'CONTROL NUMBER', 'CONTROL', 'CONTROLNUMBER', 'SAMPLE ID', 'CUC', 'control_number'];
  for (const k of knownKeys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return String(row[k]).trim();
    }
  }
  for (const key of Object.keys(row)) {
    const up = key.toUpperCase().trim();
    if (up.includes('CONTROL') || up === 'SAMPLE ID' || up === 'CUC') {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        return String(row[key]).trim();
      }
    }
  }
  return '';
}

function getRowAnalyst(row: any): string {
  if (!row) return '';
  return String(row['ANALYZED BY'] || row['TESTED BY'] || row['SUBMITTED BY'] || row['ANALYST'] || row['ANALYSTS'] || row['WHO COLLECTED'] || '').trim();
}

function getRowType(row: any): string {
  if (!row) return '';
  return String(row['TYPE'] || row['SAMPLE TYPE'] || row['CATEGORY'] || row['__sheetName']?.split(' ')[0] || '').trim();
}

function getRowCategory(row: any): string {
  if (!row) return '';
  return String(row['CATEGORY'] || row['SAMPLE TYPE'] || row['TYPE'] || '').trim();
}

function getRowDate(row: any): Date {
  if (!row) return new Date(0);
  const dateKey = Object.keys(row).find(k => {
    const up = k.toUpperCase();
    return up.includes('DATE RECEIVED') || up.includes('DATE SAMPLED') || up.includes('DATE ANALYZED') || up.includes('DATE COLLECTED') || up.includes('TIMESTAMP') || up === 'DATE' || up === 'DATE & TIME ANALYZED';
  });
  const timeKey = Object.keys(row).find(k => {
    const up = k.toUpperCase();
    return up.includes('TIME RECEIVED') || up.includes('TIME SAMPLED') || up.includes('TIME ANALYZED') || up.includes('TIME COLLECTED');
  });

  const dateReceived = dateKey ? String(row[dateKey] || '') : '';
  const timeReceived = timeKey ? String(row[timeKey] || '') : '';
  
  let parsedDate = new Date(0);
  if (dateReceived) {
     try {
       const d = new Date(dateReceived + ' ' + (timeReceived || '00:00'));
       if (!isNaN(d.getTime())) parsedDate = d;
       else if (!isNaN(new Date(dateReceived).getTime())) parsedDate = new Date(dateReceived);
     } catch(e) {}
  }
  return parsedDate;
}

function compareControlNumbers(aStr: string, bStr: string): number {
  if (!aStr && !bStr) return 0;
  if (!aStr) return 1;
  if (!bStr) return -1;

  const regex = /^([a-zA-Z\s_-]*?)(\d{2,4})?[-_/\s]?(\d+)$/;
  const matchA = aStr.trim().match(regex);
  const matchB = bStr.trim().match(regex);

  if (matchA && matchB) {
    const prefixA = (matchA[1] || '').toUpperCase().trim();
    const prefixB = (matchB[1] || '').toUpperCase().trim();
    if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
    const yearA = matchA[2] ? parseInt(matchA[2], 10) : 0;
    const yearB = matchB[2] ? parseInt(matchB[2], 10) : 0;
    if (yearA !== yearB) return yearA - yearB;
    const seqA = parseInt(matchA[3], 10);
    const seqB = parseInt(matchB[3], 10);
    if (seqA !== seqB) return seqA - seqB;
  }

  return aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' });
}

export default function Logbook() {
  const { theme, setTheme } = useTheme();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null); // For table header clicks
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  
  // Restored filters
  const [selectedAnalysts, setSelectedAnalysts] = useState<string[]>(['All']);
  const [sortBy, setSortBy] = useState<'type' | 'datetime' | 'analyst' | 'custom'>('type');
  
  const [allHeaders, setAllHeaders] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('logbook_hiddenColumns');
    if (saved) {
      try {
        return new Set(JSON.parse(saved));
      } catch (e) {}
    }
    return new Set();
  });

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('logbook_columnOrder');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const theadRef = useRef<HTMLTableSectionElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const {
    clonedContainerRef,
    clonedTheadRef,
    showCloned,
    containerStyle,
    colWidths: phantomColWidths,
    handleTableScroll
  } = useStickyHeader(tableContainerRef, theadRef);

  useEffect(() => {
    let initialized = false;
    const unsubscribe = listenToLogbookSettings((settings) => {
      if (settings) {
        if (settings.hiddenColumns) {
          setHiddenColumns(new Set(settings.hiddenColumns));
          localStorage.setItem('logbook_hiddenColumns', JSON.stringify(settings.hiddenColumns));
        }
        if (settings.columnOrder) {
          setColumnOrder(settings.columnOrder);
          localStorage.setItem('logbook_columnOrder', JSON.stringify(settings.columnOrder));
        }
      } else if (!initialized) {
        // No global settings exist yet. Push local settings to become the global default.
        const localHiddenStr = localStorage.getItem('logbook_hiddenColumns');
        const localOrderStr = localStorage.getItem('logbook_columnOrder');
        
        let initialHidden: string[] = [];
        let initialOrder: string[] = [];
        try { if(localHiddenStr) initialHidden = JSON.parse(localHiddenStr); } catch(e){}
        try { if(localOrderStr) initialOrder = JSON.parse(localOrderStr); } catch(e){}
        
        if (initialHidden.length > 0 || initialOrder.length > 0) {
           saveLogbookSettings({
             hiddenColumns: initialHidden,
             columnOrder: initialOrder
           }).catch(console.error);
        }
      }
      initialized = true;
    });
    return () => unsubscribe();
  }, []);

  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const colDropdownRef = useRef<HTMLDivElement>(null);

  const isOnline = useOnlineStatus();

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!isOnline) {
      setError('You are currently offline.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const sheets = ['SWAB 2026', 'WATER 2026', 'RM,FG,SFG 2026', 'AIR 2026'];
      const allData = await Promise.all(
        sheets.map(tab => fetchLiveSheetData(tab, forceRefresh).then(rows => rows.map(r => ({ ...r, __sheetName: tab }))))
      );
      
      const combined = allData.flat();
      
      // Determine all unique headers
      const headersSet = new Set<string>();
      // Always put sheetName first so we know origin
      headersSet.add('__sheetName');
      
      combined.forEach(row => {
        Object.keys(row).forEach(k => {
          if (!k.startsWith('_') || k === '__sheetName') {
            headersSet.add(k);
          }
        });
      });
      
      const headers = Array.from(headersSet);
      setAllHeaders(headers);
      setData(combined || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data from the live sheet.');
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (colDropdownRef.current && !colDropdownRef.current.contains(e.target as Node)) {
        setShowColumnDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  useEffect(() => {
    if (allHeaders.length === 0) return;
    setColumnOrder(prevOrder => {
      const newOrder = [...prevOrder];
      allHeaders.forEach(h => {
        if (!newOrder.includes(h)) newOrder.push(h);
      });
      return newOrder.filter(h => allHeaders.includes(h));
    });
  }, [allHeaders]);

  const handleDragStart = (e: React.DragEvent, col: string) => {
    setDraggedColumn(col);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetCol: string) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetCol) return;

    setColumnOrder(prev => {
      const newOrder = [...prev];
      const fromIndex = newOrder.indexOf(draggedColumn);
      const toIndex = newOrder.indexOf(targetCol);
      if (fromIndex !== -1 && toIndex !== -1) {
        newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, draggedColumn);
      }
      
      saveLogbookSettings({
        hiddenColumns: Array.from(hiddenColumns),
        columnOrder: newOrder
      }).catch(console.error);

      return newOrder;
    });
    setDraggedColumn(null);
  };

  const analysts = useMemo(() => {
    const set = new Set<string>();
    data.forEach(r => {
      const a = getRowAnalyst(r);
      if (a) set.add(a);
    });
    return ['All', ...Array.from(set).sort()];
  }, [data]);

  const isControlHeader = (headerName: string) => {
    const up = headerName.toUpperCase().trim();
    return up.includes('CONTROL') || up === 'SAMPLE ID' || up === 'CUC';
  };

  const handleHeaderClick = (columnName: string) => {
    setSortBy('custom'); // Switch to custom column sorting
    const isControl = isControlHeader(columnName);
    const isCurrentlyActive = (sortColumn === columnName) || (!sortColumn && isControl);

    if (isCurrentlyActive) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      if (!sortColumn) setSortColumn(columnName);
    } else {
      setSortColumn(columnName);
      setSortDirection('asc');
    }
  };

  const toggleColumnVisibility = (header: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(header)) next.delete(header);
      else next.add(header);
      
      saveLogbookSettings({
        hiddenColumns: Array.from(next),
        columnOrder
      }).catch(console.error);
      
      return next;
    });
  };

  const visibleHeaders = useMemo(() => {
    return columnOrder.filter(h => !hiddenColumns.has(h));
  }, [columnOrder, hiddenColumns]);

  const processedData = useMemo(() => {
    let result = data;
    
    if (selectedAnalysts.length > 0 && !selectedAnalysts.includes('All')) {
      result = result.filter(row => selectedAnalysts.includes(getRowAnalyst(row)));
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(query)
        )
      );
    }

    return [...result].sort((a, b) => {
      if (sortBy === 'type') {
        const typeA = getRowType(a);
        const typeB = getRowType(b);
        const typeCompare = typeA.localeCompare(typeB);
        if (typeCompare !== 0) return typeCompare;

        const catA = getRowCategory(a);
        const catB = getRowCategory(b);
        const catCompare = catA.localeCompare(catB);
        if (catCompare !== 0) return catCompare;

        const timeDiff = getRowDate(b).getTime() - getRowDate(a).getTime();
        if (timeDiff !== 0) return timeDiff;
        return compareControlNumbers(getRowControl(b), getRowControl(a));
      } else if (sortBy === 'analyst') {
        const analystCompare = getRowAnalyst(a).localeCompare(getRowAnalyst(b));
        if (analystCompare !== 0) return analystCompare;
        const timeDiff = getRowDate(b).getTime() - getRowDate(a).getTime();
        if (timeDiff !== 0) return timeDiff;
        return compareControlNumbers(getRowControl(b), getRowControl(a));
      } else if (sortBy === 'datetime') {
        const timeDiff = getRowDate(b).getTime() - getRowDate(a).getTime();
        if (timeDiff !== 0) return timeDiff;
        return compareControlNumbers(getRowControl(b), getRowControl(a));
      } else {
        // Custom column sorting (from table headers)
        let cmp = 0;
        const targetCol = sortColumn;
        const isControlSort = !targetCol || isControlHeader(targetCol);

        if (isControlSort) {
          const ctrlA = getRowControl(a);
          const ctrlB = getRowControl(b);
          cmp = compareControlNumbers(ctrlA, ctrlB);
        } else if (targetCol) {
          const valA = String(a[targetCol] ?? '').trim();
          const valB = String(b[targetCol] ?? '').trim();
          if (!valA && !valB) cmp = 0;
          else if (!valA) cmp = 1;
          else if (!valB) cmp = -1;
          else {
            cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
          }
        }

        if (cmp !== 0) {
          return sortDirection === 'asc' ? cmp : -cmp;
        }

        // Fallback
        const fallbackCtrlA = getRowControl(a);
        const fallbackCtrlB = getRowControl(b);
        return compareControlNumbers(fallbackCtrlA, fallbackCtrlB);
      }
    });
  }, [data, searchQuery, sortColumn, sortDirection, sortBy, selectedAnalysts]);

  // Reset to page 1 when filters/sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, selectedAnalysts, sortColumn, sortDirection]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return processedData.slice(start, start + rowsPerPage);
  }, [processedData, currentPage, rowsPerPage]);

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <Header theme={theme} onSetTheme={setTheme} title="Logbook" />
      
      <div className="flex-1 px-4 lg:px-8 py-6 max-w-[1600px] mx-auto w-full flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass p-4 rounded-2xl border border-[var(--border-subtle)] mb-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-primary-500" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--text-primary)]">Combined Logbook</h3>
              <p className="text-[10px] text-[var(--text-muted)] font-medium">
                {processedData.length} total records across all sample types
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <CustomSelect 
               value={sortBy} 
               onChange={(v) => setSortBy(v as any)}
               options={[
                 { value: 'type', label: 'Sort by Type/Category' },
                 { value: 'datetime', label: 'Sort by Date/Time' },
                 { value: 'analyst', label: 'Sort by Analyst' },
                 { value: 'custom', label: 'Custom Header Sort' }
               ]}
               className="w-full md:w-52 z-40"
            />
            <MultiSelect 
               values={selectedAnalysts} 
               onChange={setSelectedAnalysts}
               options={analysts.map(a => ({ value: a, label: a }))}
               className="w-full md:w-48 z-40"
            />

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search any field..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl py-2 pl-9 pr-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>

            <div className="relative" ref={colDropdownRef}>
              <button 
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                className="flex items-center gap-2 p-2 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:text-primary-500 hover:border-primary-500 transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Columns</span>
              </button>

              <AnimatePresence>
                {showColumnDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-64 max-h-96 overflow-y-auto bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 p-2 custom-scrollbar"
                  >
                    <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-[var(--border-subtle)]">
                      <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Visible Columns</span>
                      <button 
                        onClick={() => {
                          const newOrder = [...allHeaders];
                          setHiddenColumns(new Set());
                          localStorage.removeItem('logbook_hiddenColumns');
                          setColumnOrder(newOrder);
                          localStorage.removeItem('logbook_columnOrder');
                          
                          saveLogbookSettings({
                            hiddenColumns: [],
                            columnOrder: newOrder
                          }).catch(console.error);
                        }}
                        className="text-[10px] text-primary-500 hover:underline"
                      >
                        Reset
                      </button>
                    </div>
                    {columnOrder.map(header => (
                      <label 
                        key={header} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, header)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, header)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--bg-hover)] rounded-lg cursor-pointer"
                      >
                        <GripVertical className="w-3 h-3 text-[var(--text-muted)] cursor-grab opacity-50 hover:opacity-100" />
                        <input 
                          type="checkbox" 
                          checked={!hiddenColumns.has(header)}
                          onChange={() => toggleColumnVisibility(header)}
                          className="rounded text-primary-500 focus:ring-primary-500"
                        />
                        <span className="text-xs text-[var(--text-primary)] truncate" title={header === '__sheetName' ? 'Source Sheet' : header}>
                          {header === '__sheetName' ? 'Source Sheet' : header}
                        </span>
                      </label>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => loadData(true)}
              disabled={loading}
              className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-primary-500 hover:border-primary-500 transition-colors disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 mb-6 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-500 text-sm shrink-0">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="glass rounded-2xl border border-[var(--border-subtle)] flex flex-col relative w-full mb-6">
          {/* CLONED HEADER FOR WINDOW SCROLL */}
          {showCloned && createPortal(
            <div 
              ref={clonedContainerRef}
              className="fixed top-0 z-40 overflow-hidden bg-[var(--bg-card)] shadow-md hidden lg:block rounded-t-2xl border-b border-[var(--border-subtle)]"
              style={{ left: containerStyle.left, width: containerStyle.width }}
            >
              <div className="w-full min-w-max relative">
                <table className="w-full text-left border-collapse text-sm whitespace-nowrap min-w-max">
                  <thead ref={clonedTheadRef} className="shadow-sm">
                    <tr>
                      {visibleHeaders.map((h, i) => {
                        const isControl = isControlHeader(h);
                        const isSorted = (sortColumn === h) || (!sortColumn && isControl);
                        const headerTitle = h === '__sheetName' ? 'SOURCE SHEET' : h;
                        return (
                          <th 
                            key={h} 
                            onClick={() => handleHeaderClick(h)}
                            className={`px-3 py-2 font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] hover:bg-[var(--bg-hover)] uppercase tracking-wider text-[10px] whitespace-nowrap cursor-pointer select-none transition-colors group ${isControl ? 'sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}
                            style={{ ...(isControl ? { left: 0 } : {}), ...(phantomColWidths[i] ? { width: phantomColWidths[i], minWidth: phantomColWidths[i], maxWidth: phantomColWidths[i], boxSizing: 'border-box' } : {}) }}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span>{headerTitle}</span>
                              <span className="shrink-0">
                                {isSorted ? (
                                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-primary-500" /> : <ArrowDown className="w-3 h-3 text-primary-500" />
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                                )}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                </table>
              </div>
            </div>
          , document.body)}

          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-[var(--bg-card)]/50 backdrop-blur-sm z-20 rounded-2xl">
              <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mb-4" />
              <p className="text-[var(--text-secondary)] font-medium">Loading combined logbook...</p>
            </div>
          ) : (
            <div 
              ref={tableContainerRef}
              onScroll={handleTableScroll}
              className="w-full overflow-x-auto custom-scrollbar rounded-2xl"
            >
              <table className="w-full text-left border-collapse text-sm min-w-max">
                <thead ref={theadRef} className="sticky top-0 z-20 shadow-sm">
                  <tr>
                    {visibleHeaders.map((h, i) => {
                      const isControl = isControlHeader(h);
                      const isSorted = (sortColumn === h) || (!sortColumn && isControl);
                      const headerTitle = h === '__sheetName' ? 'SOURCE SHEET' : h;
                      return (
                        <th 
                          key={h} 
                          draggable
                          onDragStart={(e) => handleDragStart(e, h)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, h)}
                          onClick={() => handleHeaderClick(h)}
                          className={`px-3 py-2 font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] hover:bg-[var(--bg-hover)] uppercase tracking-wider text-[10px] whitespace-nowrap cursor-pointer select-none transition-colors group ${isControl ? 'sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}
                          style={isControl ? { left: 0 } : {}}
                          title={`Sort by ${headerTitle} (Drag to reorder)`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span>{headerTitle}</span>
                            <span className="shrink-0">
                              {isSorted ? (
                                sortDirection === 'asc' ? (
                                  <ArrowUp className="w-3 h-3 text-primary-500" />
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-primary-500" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                              )}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={visibleHeaders.length} className="p-8 text-center text-sm text-[var(--text-muted)] bg-[var(--bg-surface)]">
                        No records found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((row, rowIndex) => {
                      const isSelected = selectedRowIndex === rowIndex;
                      return (
                        <tr 
                          key={rowIndex} 
                          onClick={() => setSelectedRowIndex(isSelected ? null : rowIndex)}
                          className={`transition-colors group cursor-pointer ${isSelected ? 'bg-[var(--bg-selected)] outline outline-2 outline-primary-500 relative z-10' : 'hover:bg-[var(--bg-hover)]'}`}
                        >
                          {visibleHeaders.map((h, colIndex) => {
                            const isControl = isControlHeader(h);
                            const baseBg = h === '__sheetName' ? 'bg-[color-mix(in_srgb,var(--bg-card)_95%,var(--color-primary-500))]' : 'bg-[var(--bg-card)]';
                            const cellBg = isSelected ? 'bg-[var(--bg-selected)]' : baseBg;
                            
                            return (
                              <td 
                                key={colIndex} 
                                className={`px-3 py-1.5 text-xs text-[var(--text-primary)] border border-[var(--border-subtle)] whitespace-nowrap max-w-[300px] truncate ${h === '__sheetName' ? 'font-semibold text-primary-600' : ''} ${isControl ? `sticky left-0 z-20 ${cellBg} shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]` : cellBg}`}
                                style={isControl ? { left: 0 } : {}}
                              >
                                {row[h] !== undefined && row[h] !== null && String(row[h]).trim() !== '' ? String(row[h]) : '-'}
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
          )}
        </div>
        <Pagination
          currentPage={currentPage}
          totalRows={processedData.length}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }}
        />
      </div>
    </div>
  );
}







