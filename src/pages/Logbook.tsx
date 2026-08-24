import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, RefreshCw, AlertCircle, Search, User } from 'lucide-react';
import Header from '../components/Layout/Header';
import CustomSelect from '../components/ui/CustomSelect';
import { fetchLiveSheetData } from '../utils/api';
import { useTheme } from '../hooks/useTheme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAuth } from '../hooks/useAuth';

export default function Logbook() {
  const { theme, setTheme } = useTheme();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'type' | 'datetime' | 'analyst'>('type');
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
      const allData = await Promise.all(sheets.map(tab => fetchLiveSheetData(tab).then(rows => rows.map(r => ({ ...r, __sheetName: tab })))));
      
      const combined = allData.flat();
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

  const normalizedData = useMemo(() => {
    return data.map((row, index) => {
      // Find Analyst
      const analyst = String(row['ANALYZED BY'] || row['TESTED BY'] || row['SUBMITTED BY'] || row['ANALYST'] || row['ANALYSTS'] || row['WHO COLLECTED'] || '').trim();
      
      const control = String(row['CONTROL #'] || row['CONTROL NUMBER'] || row['CONTROLNUMBER'] || '');
      const name = String(row['SAMPLE NAME'] || row['SAMPLE'] || row['POINT'] || row['SAMPLE DETAILS'] || '');
      const type = String(row['TYPE'] || row['SAMPLE TYPE'] || row['CATEGORY'] || row['__sheetName']?.split(' ')[0] || '');
      const category = String(row['CATEGORY'] || row['SAMPLE TYPE'] || row['TYPE'] || '');
      
      // Date and Time parsing
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

      const dateReleased = String(row['DATE RELEASED'] || row['DATE & TIME RELEASED'] || row['DATE'] || '');
      const status = String(row['STATUS'] || row['REMARKS'] || '');

      let batchNumber = '-';
      const mix = row['MIXING BATCH #'] || row['BATCH #'] || '';
      const cuc = row['CUC #'] || '';
      if (mix && cuc) batchNumber = `${mix} / ${cuc}`;
      else if (cuc || mix) batchNumber = cuc || mix;

      return {
        id: `${row.__sheetName}-${index}`,
        originalRow: row,
        sheetName: row.__sheetName,
        control,
        batchNumber,
        name,
        type,
        category,
        dateReceived,
        timeReceived,
        parsedDate,
        analyst,
        dateReleased,
        status
      };
    });
  }, [data]);

  const analysts = useMemo(() => {
    const set = new Set<string>();
    normalizedData.forEach(r => {
      if (r.analyst) set.add(r.analyst);
    });
    return ['All', ...Array.from(set).sort()];
  }, [normalizedData]);

  const filteredAndSorted = useMemo(() => {
    let filtered = normalizedData.filter(r => {
      if (selectedAnalyst !== 'All' && r.analyst !== selectedAnalyst) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.control.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.analyst.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'type') {
        const typeA = (a.type || '').trim();
        const typeB = (b.type || '').trim();
        const typeCompare = typeA.localeCompare(typeB);
        if (typeCompare !== 0) return typeCompare;

        const catA = (a.category || '').trim();
        const catB = (b.category || '').trim();
        const catCompare = catA.localeCompare(catB);
        if (catCompare !== 0) return catCompare;

        const timeDiff = b.parsedDate.getTime() - a.parsedDate.getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.control.localeCompare(a.control, undefined, { numeric: true });
      } else if (sortBy === 'analyst') {
        const analystCompare = a.analyst.localeCompare(b.analyst);
        if (analystCompare !== 0) return analystCompare;
        const timeDiff = b.parsedDate.getTime() - a.parsedDate.getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.control.localeCompare(a.control, undefined, { numeric: true });
      } else {
        const timeDiff = b.parsedDate.getTime() - a.parsedDate.getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.control.localeCompare(a.control, undefined, { numeric: true });
      }
    });
  }, [normalizedData, selectedAnalyst, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-transparent">
      <Header theme={theme} onSetTheme={setTheme} title="Logbook" />
      
      <div className="px-4 lg:px-8 max-w-[1400px] mx-auto pb-24 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass p-4 rounded-2xl border border-[var(--border-subtle)] mt-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-500" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--text-primary)]">Combined Logbook</h3>
              <p className="text-[10px] text-[var(--text-muted)] font-medium">
                {sortBy === 'type' 
                  ? 'Viewing all samples sorted by type/category' 
                  : sortBy === 'analyst' 
                    ? 'Viewing all samples sorted by analyst' 
                    : 'Viewing all samples sorted by date and time'}
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-2">
             <CustomSelect 
               value={sortBy} 
               onChange={(v) => setSortBy(v as any)}
               options={[
                 { value: 'type', label: 'Sort by Type/Category' },
                 { value: 'datetime', label: 'Sort by Date/Time' },
                 { value: 'analyst', label: 'Sort by Analyst' }
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
                placeholder="Search control # or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl py-2 pl-9 pr-4 text-xs text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
            <button 
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-primary-500 hover:border-primary-500 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-500 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-[var(--bg-card)]/50 border-b border-[var(--border-subtle)]">
                  <th className="p-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Control #</th>
                  <th className="p-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Sample Name</th>
                  <th className="p-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Type / Category</th>
                  <th className="p-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Date & Time</th>
                  <th className="p-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Analyst</th>
                  <th className="p-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Date Released</th>
                  <th className="p-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="p-3"><div className="h-4 bg-[var(--border-subtle)] rounded w-24"></div></td>
                      <td className="p-3"><div className="h-4 bg-[var(--border-subtle)] rounded w-32"></div></td>
                      <td className="p-3"><div className="h-4 bg-[var(--border-subtle)] rounded w-20"></div></td>
                      <td className="p-3"><div className="h-4 bg-[var(--border-subtle)] rounded w-28"></div></td>
                      <td className="p-3"><div className="h-4 bg-[var(--border-subtle)] rounded w-16"></div></td>
                      <td className="p-3"><div className="h-4 bg-[var(--border-subtle)] rounded w-24"></div></td>
                      <td className="p-3"><div className="h-4 bg-[var(--border-subtle)] rounded w-16"></div></td>
                    </tr>
                  ))
                ) : filteredAndSorted.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm text-[var(--text-muted)]">
                      No records found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAndSorted.map((row) => (
                    <tr key={row.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="p-3 text-xs font-bold text-[var(--text-primary)]">{row.control}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{row.name}</td>
                      <td className="p-3">
                         <div className="flex flex-col">
                           <span className="text-[10px] font-bold text-primary-500">{row.type}</span>
                           {row.category && row.category !== row.type && (
                             <span className="text-[10px] text-[var(--text-muted)]">{row.category}</span>
                           )}
                         </div>
                      </td>
                      <td className="p-3">
                         <div className="flex flex-col">
                           <span className="text-xs text-[var(--text-primary)]">{row.dateReceived}</span>
                           <span className="text-[10px] text-[var(--text-muted)]">{row.timeReceived}</span>
                         </div>
                      </td>
                      <td className="p-3 text-xs text-blue-500 font-bold">{row.analyst}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{row.dateReleased}</td>
                      <td className="p-3">
                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] uppercase">
                          {row.status || 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

