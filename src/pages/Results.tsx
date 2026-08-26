import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileSpreadsheet, RefreshCw, AlertCircle, Search, Edit2, X, Save, FileText,
  ArrowUpDown, ArrowUp, ArrowDown, Eye
} from 'lucide-react';
import Header from '../components/Layout/Header';
import { fetchLiveSheetData, fetchSheetSchema } from '../utils/api';
import { updateSheetRow } from '../utils/api';
import { getSheetTabName } from '../utils/sheetMapping';
import { useTheme } from '../hooks/useTheme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useToast } from '../components/ui/Toast';
import type { SampleType } from '../types';
import Button from '../components/ui/Button';
import { generateDocxReport } from '../utils/report';

import { useSearchParams } from 'react-router-dom';

type TabOption = 'ENVI' | 'WATER' | 'RawMats' | 'AIR';

const TABS: { id: TabOption; label: string }[] = [
  { id: 'ENVI', label: 'SWAB 2026' },
  { id: 'WATER', label: 'WATER 2026' },
  { id: 'RawMats', label: 'RM,FG,SFG 2026' },
  { id: 'AIR', label: 'AIR 2026' },
];

/**
 * Extracts the Control Number value from a row object across known variations.
 */
function getRowControl(row: any, headersList?: string[]): string {
  if (!row) return '';
  const knownKeys = ['CONTROL #', 'CONTROL NUMBER', 'CONTROL', 'CONTROLNUMBER', 'SAMPLE ID', 'CUC', 'control_number'];
  for (const k of knownKeys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return String(row[k]).trim();
    }
  }
  if (headersList) {
    for (const h of headersList) {
      const up = h.toUpperCase().trim();
      if (up.includes('CONTROL') || up === 'SAMPLE ID' || up === 'CUC') {
        if (row[h] !== undefined && row[h] !== null && String(row[h]).trim() !== '') {
          return String(row[h]).trim();
        }
      }
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

/**
 * Natural comparison of control numbers (e.g. E26-1222 < E26-1235, 26-9 < 26-10, RM-26-01 < RM-26-02).
 */
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
    if (prefixA !== prefixB) {
      return prefixA.localeCompare(prefixB);
    }

    const yearA = matchA[2] ? parseInt(matchA[2], 10) : 0;
    const yearB = matchB[2] ? parseInt(matchB[2], 10) : 0;
    if (yearA !== yearB) {
      return yearA - yearB;
    }

    const seqA = parseInt(matchA[3], 10);
    const seqB = parseInt(matchB[3], 10);
    if (seqA !== seqB) {
      return seqA - seqB;
    }
  }

  return aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' });
}

export default function Results() {
  const { theme, setTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTab, setSelectedTab] = useState<TabOption>((searchParams.get('tab') as TabOption) || 'ENVI');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null); // null means default to Control #
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const colDropdownRef = useRef<HTMLDivElement>(null);
  
  const isOnline = useOnlineStatus();
  const { showToast } = useToast();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (colDropdownRef.current && !colDropdownRef.current.contains(e.target as Node)) {
        setShowColumnDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab') as TabOption;
    if (tab && TABS.some(t => t.id === tab)) {
      setSelectedTab(tab);
    }
    const search = searchParams.get('search');
    if (search !== null) {
      setSearchQuery(search);
    }
  }, [searchParams]);

  // Reset sorting state when switching tabs to ensure Control # ascending default
  useEffect(() => {
    setSortColumn(null);
    setSortDirection('asc');
    setHiddenColumns(new Set());
    setColumnOrder([]); // reset order on tab switch
  }, [selectedTab]);

  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  useEffect(() => {
    setColumnOrder(prevOrder => {
      const newOrder = [...prevOrder];
      headers.forEach(h => {
        if (!newOrder.includes(h)) newOrder.push(h);
      });
      return newOrder.filter(h => headers.includes(h));
    });
  }, [headers]);

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
      return newOrder;
    });
    setDraggedColumn(null);
  };

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
      const rowsPromise = fetchLiveSheetData(sheetTab);
      const schemaPromise = fetchSheetSchema(sheetTab);
      
      const [rows, schema] = await Promise.all([rowsPromise, schemaPromise]);
      
      if (rows && rows.length > 0) {
        if (schema && schema.length > 0) {
          setHeaders(schema);
        } else {
          // Fallback if schema fails
          let allHeaders: string[] = [];
          for (const row of rows) {
            const keys = Object.keys(row).filter(k => !k.startsWith('_'));
            if (keys.length > allHeaders.length) {
              allHeaders = keys;
            }
          }
          setHeaders(allHeaders);
        }
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

  const isControlHeader = (headerName: string) => {
    const up = headerName.toUpperCase().trim();
    return up.includes('CONTROL') || up === 'SAMPLE ID' || up === 'CUC';
  };

  const handleHeaderClick = (columnName: string) => {
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
    return columnOrder.filter(h => !hiddenColumns.has(h));
  }, [columnOrder, hiddenColumns]);

  const processedData = useMemo(() => {
    // 1. Filter by search query
    let result = data;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(query)
        )
      );
    }

    // 2. Sort by active column (default: Control # ascending)
    return [...result].sort((a, b) => {
      let cmp = 0;
      const targetCol = sortColumn;
      const isControlSort = !targetCol || isControlHeader(targetCol);

      if (isControlSort) {
        const ctrlA = getRowControl(a, headers);
        const ctrlB = getRowControl(b, headers);
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

      // Tie breaker 1: Control Number ascending
      const fallbackCtrlA = getRowControl(a, headers);
      const fallbackCtrlB = getRowControl(b, headers);
      const ctrlCmp = compareControlNumbers(fallbackCtrlA, fallbackCtrlB);
      if (ctrlCmp !== 0) return ctrlCmp;

      // Tie breaker 2: Original Sheet Row Index
      return (a._rowIndex || 0) - (b._rowIndex || 0);
    });
  }, [data, searchQuery, sortColumn, sortDirection, headers]);

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <Header theme={theme} onSetTheme={setTheme} title="Live Results Dashboard" />
      
      <div className="flex-1 px-4 lg:px-8 py-6 max-w-[1600px] mx-auto w-full flex flex-col">
        
        <div className="flex items-center p-1 gap-1 overflow-x-auto hide-scrollbar bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl w-max max-w-full mb-6">
          {TABS.map(tab => {
            const isActive = selectedTab === tab.id;
            let bgAccent = 'bg-primary-500';
            if (tab.id === 'ENVI') bgAccent = 'bg-green-500';
            if (tab.id === 'WATER') bgAccent = 'bg-blue-500';
            if (tab.id === 'RawMats') bgAccent = 'bg-pink-500';
            if (tab.id === 'AIR') bgAccent = 'bg-yellow-500';

            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`relative whitespace-nowrap px-5 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 cursor-pointer
                  ${isActive 
                    ? 'text-white' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="results-active-tab"
                    className={`absolute inset-0 ${bgAccent} rounded-xl shadow-sm`}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">{tab.label}</span>
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
          <div className="flex items-center gap-2 w-full md:w-auto">
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

            <div className="relative" ref={colDropdownRef}>
              <button 
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-xl text-sm font-bold hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
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
                    {headers.map(header => (
                      <label key={header} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--bg-hover)] rounded-lg cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={!hiddenColumns.has(header)}
                          onChange={() => toggleColumnVisibility(header)}
                          className="rounded text-primary-500 focus:ring-primary-500"
                        />
                        <span className="text-xs text-[var(--text-primary)] truncate" title={header}>
                          {header}
                        </span>
                      </label>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <button 
            onClick={() => loadData(selectedTab)}
            disabled={loading || !isOnline}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-xl text-sm font-bold hover:bg-[var(--bg-hover)] disabled:opacity-50 transition-all cursor-pointer w-full md:w-auto"
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
        <div className="flex-1 glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden flex flex-col min-h-[400px]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-[var(--text-muted)]">
              <RefreshCw className="w-8 h-8 animate-spin mb-4 text-primary-500" />
              <p>Fetching live records...</p>
            </div>
          ) : processedData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-[var(--text-muted)] text-center">
              <FileSpreadsheet className="w-12 h-12 mb-4 opacity-20" />
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">No Records Found</h3>
              <p>Try adjusting your search or sync the sheet.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-sm min-w-max">
                <thead className="sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-3 py-2 font-bold text-[var(--text-secondary)] border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] uppercase tracking-wider text-[10px]">Actions</th>
                    {visibleHeaders.map((h, i) => {
                      const isControl = isControlHeader(h);
                      const isSorted = (sortColumn === h) || (!sortColumn && isControl);
                      return (
                        <th 
                          key={h} 
                          draggable
                          onDragStart={(e) => handleDragStart(e, h)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, h)}
                          onClick={() => handleHeaderClick(h)}
                          className="px-3 py-2 font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] hover:bg-[var(--bg-hover)] uppercase tracking-wider text-[10px] whitespace-nowrap cursor-pointer select-none transition-colors group"
                          title={`Sort by ${h} (Drag to reorder)`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span>{h}</span>
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
                  {processedData.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-[var(--bg-hover)] transition-colors group">
                      <td className="px-3 py-1.5 border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditClick(row)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-primary-500 hover:border-primary-500 transition-colors shadow-sm cursor-pointer"
                            title="Edit Row"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Edit</span>
                          </button>
                          <button
                            onClick={() => handleGenerateReport(row)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-success-500 hover:border-success-500 transition-colors shadow-sm cursor-pointer"
                            title="Generate Report"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Print</span>
                          </button>
                        </div>
                      </td>
                      {visibleHeaders.map((h, colIndex) => (
                        <td key={colIndex} className="px-3 py-1.5 text-xs text-[var(--text-primary)] border border-[var(--border-subtle)] whitespace-nowrap max-w-sm truncate bg-[var(--bg-card)]">
                          {row[h] !== undefined && row[h] !== null && String(row[h]).trim() !== '' ? String(row[h]) : '-'}
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
              <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
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
                        'REMARKS',
                        'REPEATED RESULTS',
                        'STATUS',
                        'DATE RELEASED',
                        'RELEASED BY',
                        'DATE ANALYZED',
                        'ANALYZED BY'
                      ];
                      if (editablePatterns.some(pattern => upperH.includes(pattern))) return false;
                      return true;
                    }

                    if (selectedTab === 'ENVI') {
                      const editablePatterns = [
                        'TVC (COUNT)',
                        'GRAM STAINING',
                        'REMARKS',
                        'STATUS',
                        'DATE RELEASED',
                        'RELEASED BY',
                        'DATE ANALYZED',
                        'ANALYZED BY'
                      ];
                      if (editablePatterns.some(pattern => upperH.includes(pattern))) return false;
                      return true;
                    }

                    if (selectedTab === 'WATER') {
                      const editablePatterns = [
                        'TVC (COUNT)',
                        'GRAM NEGATIVE (COUNT)',
                        'REMARKS',
                        'STATUS',
                        'DATE RELEASED',
                        'RELEASED BY',
                        'DATE ANALYZED',
                        'ANALYZED BY'
                      ];
                      if (editablePatterns.some(pattern => upperH.includes(pattern))) return false;
                      return true;
                    }

                    if (selectedTab === 'AIR') {
                      const editablePatterns = [
                        'TVC (COUNT)',
                        'REMARKS',
                        'STATUS',
                        'DATE RELEASED',
                        'RELEASED BY'
                      ];
                      if (editablePatterns.some(pattern => upperH.includes(pattern))) return false;
                      return true;
                    }
                    
                    return false;
                  })();

                  const isHidden = (() => {
                    if (isReadOnly && !upperH.includes('CONTROL') && !upperH.includes('SAMPLE') && !upperH.includes('POINT') && !upperH.includes('BATCH') && !upperH.includes('CUC')) {
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
                            ? 'bg-[var(--bg-card)] text-[var(--text-muted)] cursor-not-allowed' 
                            : 'bg-[var(--bg-input)] text-[var(--text-primary)] focus:border-primary-500 focus:ring-1 focus:ring-primary-500'
                          }`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-card)] flex justify-end gap-3">
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

