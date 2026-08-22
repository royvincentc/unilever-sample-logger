import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, RefreshCw, AlertCircle, Search, User } from 'lucide-react';
import Header from '../components/Layout/Header';
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
      const type = String(row['SAMPLE TYPE'] || row['CATEGORY'] || row['__sheetName'].split(' ')[0] || '');
      const category = String(row['SAMPLE TYPE'] || row['CATEGORY'] || '');
      
      // Date and Time parsing
      const dateReceived = String(row['DATE RECEIVED'] || row['DATE SAMPLED'] || row['TIMESTAMP'] || '');
      const timeReceived = String(row['TIME RECEIVED'] || row['TIME SAMPLED'] || '');
      
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

      return {
        id: `${row.__sheetName}-${index}`,
        originalRow: row,
        sheetName: row.__sheetName,
        control,
        name,
        type,
        category,
        qty: '1',
        unit: row.__sheetName.includes('SWAB') ? 'swab' : (row.__sheetName.includes('WATER') ? '120 mL' : '-'),
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
        return r.control.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.analyst.toLowerCase().includes(q);
      }
      return true;
    });

    return filtered.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
  }, [normalizedData, selectedAnalyst, searchQuery]);

  return (
    <div className="min-h-screen bg-[var(--bg-body)]">
      <Header theme={theme} onSetTheme={setTheme} title="Logbook" />
      
      <div className="px-4 lg:px-8 max-w-[1400px] mx-auto pb-24 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass p-4 rounded-2xl border border-[var(--border-subtle)] mt-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-500" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--text-primary)]">Combined Logbook</h3>
              <p className="text-[10px] text-[var(--text-muted)] font-medium">Viewing all samples sorted by date and time</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-2">
            <div className="relative w-full md:w-48">
               <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
               <select 
                 value={selectedAnalyst} 
                 onChange={e => setSelectedAnalyst(e.target.value)}
                 className="w-full bg-[var(--bg-body)] border border-[var(--border-subtle)] rounded-xl py-2 pl-9 pr-4 text-xs text-[var(--text-primary)] focus:outline-none focus:border-primary-500 appearance-none cursor-pointer"
               >
                 {analysts.map(a => <option key={a} value={a}>{a}</option>)}
               </select>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search control # or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--bg-body)] border border-[var(--border-subtle)] rounded-xl py-2 pl-9 pr-4 text-xs text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
            <button 
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-[var(--bg-body)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-primary-500 hover:border-primary-500 transition-colors disabled:opacity-50"
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
                <tr className="bg-[var(--bg-body)]/50 border-b border-[var(--border-subtle)]">
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
                           <span className="text-[10px] text-[var(--text-muted)]">{row.category}</span>
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
                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-[var(--bg-body)] border border-[var(--border-subtle)] text-[var(--text-secondary)] uppercase">
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
