import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, RefreshCw, AlertCircle, Search, ArrowUp, ArrowDown, ArrowUpDown, Eye, EyeOff } from 'lucide-react';
import Header from '../components/Layout/Header';
import CustomSelect from '../components/ui/CustomSelect';
import { fetchLiveSheetData } from '../utils/api';
import { useTheme } from '../hooks/useTheme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

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
  
  // Restored filters
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'type' | 'datetime' | 'analyst' | 'custom'>('type');
  
  const [allHeaders, setAllHeaders] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const colDropdownRef = useRef<HTMLDivElement>(null);

  const isOnline = useOnlineStatus();

  const loadData = useCallback(async () => {
    if (!isOnline) {
      setError('You are currently offline.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const sheets = ['SWAB 2026', 'WATER 2026', 'RM,FG,SFG 2026', 'AIR 2026'];
      const allData = await Promise.all(
        sheets.map(tab => fetchLiveSheetData(tab).then(rows => rows.map(r => ({ ...r, __sheetName: tab }))))
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
      return next;
    });
  };

  const visibleHeaders = useMemo(() => {
    return allHeaders.filter(h => !hiddenColumns.has(h));
  }, [allHeaders, hiddenColumns]);

  const processedData = useMemo(() => {
    let result = data;
    
    if (selectedAnalyst !== 'All') {
      result = result.filter(row => getRowAnalyst(row) === selectedAnalyst);
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
  }, [data, searchQuery, sortColumn, sortDirection, sortBy, selectedAnalyst]);

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
            <CustomSelect 
               value={selectedAnalyst} 
               onChange={setSelectedAnalyst}
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
                        onClick={() => setHiddenColumns(new Set())}
                        className="text-[10px] text-primary-500 hover:underline"
                      >
                        Reset
                      </button>
                    </div>
                    {allHeaders.map(header => (
                      <label key={header} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--bg-hover)] rounded-lg cursor-pointer">
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
              onClick={loadData}
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

        <div className="flex-1 glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden flex flex-col relative min-h-0">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-card)]/50 backdrop-blur-sm z-20">
              <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mb-4" />
              <p className="text-[var(--text-secondary)] font-medium">Loading combined logbook...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-sm min-w-max">
                <thead className="sticky top-0 z-10 shadow-sm">
                  <tr>
                    {visibleHeaders.map((h, i) => {
                      const isControl = isControlHeader(h);
                      const isSorted = (sortColumn === h) || (!sortColumn && isControl);
                      const headerTitle = h === '__sheetName' ? 'SOURCE SHEET' : h;
                      return (
                        <th 
                          key={i} 
                          onClick={() => handleHeaderClick(h)}
                          className="px-3 py-2 font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] hover:bg-[var(--bg-hover)] uppercase tracking-wider text-[10px] whitespace-nowrap cursor-pointer select-none transition-colors group"
                          title={`Sort by ${headerTitle}`}
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
                  {processedData.length === 0 ? (
                    <tr>
                      <td colSpan={visibleHeaders.length} className="p-8 text-center text-sm text-[var(--text-muted)] bg-[var(--bg-surface)]">
                        No records found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    processedData.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-[var(--bg-hover)] transition-colors group">
                        {visibleHeaders.map((h, colIndex) => (
                          <td key={colIndex} className={`px-3 py-1.5 text-xs text-[var(--text-primary)] border border-[var(--border-subtle)] whitespace-nowrap max-w-[300px] truncate ${h === '__sheetName' ? 'bg-primary-500/5 font-semibold text-primary-600' : 'bg-[var(--bg-card)]'}`}>
                            {row[h] !== undefined && row[h] !== null && String(row[h]).trim() !== '' ? String(row[h]) : '-'}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

