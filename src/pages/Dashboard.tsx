import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  Droplets,
  Package,
  Clock,
  AlertCircle,
  CalendarDays,
  ArrowUpRight,
  UploadCloud,
  BarChart3,
  CheckCircle2,
  MoreVertical,
  Activity,
  ListTodo,
  RefreshCw,
  FileText,
  FlaskConical as Flask,
  Droplets as WaterIcon,
  Package as Box
} from 'lucide-react';
import Header from '../components/Layout/Header';
import { getHistory, importHistoryBatch } from '../utils/db';
import { getUserName } from '../utils/auth';
import { fetchHistoryFromSheet } from '../utils/api';
import { useToast } from '../components/ui/Toast';
import type { HistoryEntry } from '../types';

interface DashboardProps {
  theme: 'light' | 'dark' | 'system';
  onSetTheme: (theme: 'light' | 'dark' | 'system') => void;
  queueCount: number;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const quickActions = [
  { type: 'ENVI', label: 'ENVI', sub: 'Environmental Swab Samples', icon: FlaskConical, bg: 'bg-emerald-500/10', color: 'text-emerald-500' },
  { type: 'WATER', label: 'WATER', sub: 'Water Source Samples', icon: Droplets, bg: 'bg-blue-500/10', color: 'text-blue-500' },
  { type: 'RawMats', label: 'RawMats', sub: 'Raw Materials & Finished Goods', icon: Package, bg: 'bg-violet-500/10', color: 'text-violet-500' },
  { type: 'upload', label: 'Upload Results', sub: 'Import data from instruments', icon: UploadCloud, bg: 'bg-[var(--bg-hover)]', color: 'text-[var(--text-secondary)]' },
  { type: 'reports', label: 'View Reports', sub: 'Analytics & Compliance', icon: BarChart3, bg: 'bg-[var(--bg-hover)]', color: 'text-[var(--text-secondary)]' },
];

export default function Dashboard({ theme, onSetTheme, queueCount }: DashboardProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [recent, setRecent] = useState<HistoryEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState({
    dueToday: 0,
    overdue: 0,
    upcoming: 0,
    ongoing: 0,
    pendingRelease: 0
  });
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const history = await getHistory(100);
    const currentUser = getUserName();
    
    // Filter history for the current user for personal stats
    const myHistory = history.filter(h => h.submittedBy === currentUser);
    setRecent(history.slice(0, 10)); // Still show last 10 global recent for the table

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let dueToday = 0;
    let overdue = 0;
    let upcoming = 0;
    let ongoing = 0;
    let pendingRelease = 0;
    const tasks: any[] = [];

    // Stats and Upcoming are PERSONAL
    myHistory.forEach(entry => {
      const statusStr = entry.status as string;
      if (statusStr === 'ONGOING' || statusStr === 'ON GOING') ongoing++;
      if (entry.status === 'PENDING RELEASE') pendingRelease++;
      
      // Calculate incubation tasks for active samples
      if (entry.status !== 'RELEASED' && entry.status !== 'COMPLETED') {
        const baseDate = new Date(entry.dateAnalyzed || entry.dateSampled || entry.submittedAt);
        baseDate.setHours(0, 0, 0, 0);

        const checkTask = (name: string, days: number, icon: any, color: string) => {
          const dueDate = new Date(baseDate);
          dueDate.setDate(dueDate.getDate() + days);
          
          const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          // Only show if not finished (checking results object for this reading)
          const isDone = entry.results && entry.results[name];
          if (isDone) return;

          if (diffDays === 0) dueToday++;
          else if (diffDays < 0) overdue++;
          else upcoming++;

          tasks.push({
            id: `${entry.id}-${name}`,
            name: `${entry.sampleName} - ${name}`,
            dueDate,
            diffDays,
            icon,
            color
          });
        };

        if (entry.sampleType === 'ENVI') {
          checkTask('Final Reading (48h)', 2, Flask, 'text-emerald-500');
        } else if (entry.sampleType === 'WATER') {
          checkTask('1st Reading (48h)', 2, WaterIcon, 'text-blue-500');
          checkTask('2nd Reading (7 Days)', 7, WaterIcon, 'text-cyan-500');
          checkTask('Final Reading (14 Days)', 14, WaterIcon, 'text-indigo-500');
        } else if (entry.sampleType === 'RawMats') {
          checkTask('APC Final (7 Days)', 7, Box, 'text-purple-500');
          checkTask('MY Final (7 Days)', 7, Box, 'text-pink-500');
        }
      }
    });

    setStats({ dueToday, overdue, upcoming, ongoing, pendingRelease });
    setUpcomingTasks(tasks.sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime()).slice(0, 3));
  }, []);

  useEffect(() => {
    loadData();
    
    // Background sync on load to ensure shared history is real-time
    const autoSync = async () => {
      setSyncStatus('syncing');
      try {
        const sheetHistory = await fetchHistoryFromSheet();
        if (sheetHistory.length > 0) {
          await importHistoryBatch(sheetHistory);
          await loadData(); // Reload UI with fresh data
          setSyncStatus('success');
          setSyncError(null);
        } else {
          setSyncStatus('success'); // Empty is still a "success" connection
        }
      } catch (e: any) {
        setSyncStatus('error');
        setSyncError(e.message || 'Unknown sync error');
        console.error('Background sync failed', e);
      }
    };
    autoSync();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const externalHistory = await fetchHistoryFromSheet();
      if (externalHistory.length > 0) {
        await importHistoryBatch(externalHistory);
        loadData();
        showToast('success', 'Sync Complete', `Synced ${externalHistory.length} entries from Google Sheets`);
      } else {
        showToast('info', 'No New Data', 'Everything is up to date with Google Sheets');
      }
    } catch (error) {
      showToast('error', 'Sync Failed', 'Could not reach n8n sync endpoint');
    } finally {
      setSyncing(false);
    }
  };

  const userName = getUserName();

  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const todayCount = recent.filter((r) => {
    const d = new Date(r.submittedAt);
    return d.toDateString() === today.toDateString();
  }).length;

  const handleAction = (type: string) => {
    if (type === 'upload' || type === 'reports') {
      navigate('/results');
    } else {
      navigate(`/new?type=${type}`);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'ONGOING' || status === 'ON GOING') return <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"/>IN PROGRESS</span>;
    if (status === 'PENDING RELEASE') return <span className="px-2 py-1 rounded-full bg-warning-500/10 text-warning-500 text-[10px] font-bold uppercase flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-warning-500"/>FOR REVIEW</span>;
    if (status === 'RELEASED') return <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>COMPLETED</span>;
    return <span className="px-2 py-1 rounded-full bg-[var(--bg-hover)] text-[var(--text-secondary)] text-[10px] font-bold uppercase">{status}</span>;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-body)]">
      <Header theme={theme} onSetTheme={onSetTheme} title="" />

      <motion.div variants={container} initial="hidden" animate="show" className="px-4 lg:px-8 py-2 max-w-[1600px] mx-auto">
        <div className="flex flex-col xl:flex-row gap-6">
          
          {/* Main Column */}
          <div className="flex-1 space-y-6">
            
            {/* Welcome */}
            <motion.div variants={item}>
              <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text-primary)]">{greeting}, {userName} 👋</h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
                {dateStr} &bull; {timeStr}
              </p>
            </motion.div>

            {/* Stats row - Scrollable on mobile, grid on desktop */}
            <motion.div variants={item} className="flex overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0 lg:pb-0 hide-scrollbar gap-4 lg:grid lg:grid-cols-6 lg:gap-4">
              <div className="glass rounded-xl p-4 min-w-[140px] flex-shrink-0 lg:col-span-1 border border-[var(--border-subtle)]">
                <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Today</span>
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{todayCount}</p>
              </div>
              <div className="glass rounded-xl p-4 min-w-[140px] flex-shrink-0 lg:col-span-1 border border-[var(--border-subtle)]">
                <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
                  <Package className="w-4 h-4 text-primary-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Total Samples</span>
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{recent.length}</p>
              </div>
              <div className="glass rounded-xl p-4 min-w-[140px] flex-shrink-0 lg:col-span-1 border border-[var(--border-subtle)]">
                <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
                  <ListTodo className="w-4 h-4 text-violet-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">In Queue</span>
                </div>
                <p className={`text-2xl font-bold ${queueCount > 0 ? 'text-warning-500' : 'text-[var(--text-primary)]'}`}>{queueCount}</p>
              </div>
              <div className="glass rounded-xl p-4 min-w-[140px] flex-shrink-0 lg:col-span-1 border border-[var(--border-subtle)]">
                <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
                  <FlaskConical className="w-4 h-4 text-warning-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Incubating</span>
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{recent.filter(r => r.status === 'ONGOING').length}</p>
              </div>
              <div className="glass rounded-xl p-4 min-w-[140px] flex-shrink-0 lg:col-span-1 border border-[var(--border-subtle)]">
                <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Completed</span>
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{recent.filter(r => r.status === 'COMPLETED').length}</p>
              </div>
              <div className="glass rounded-xl p-4 min-w-[140px] flex-shrink-0 lg:col-span-1 border border-[var(--border-subtle)]">
                <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
                  <Clock className="w-4 h-4 text-cyan-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Pending</span>
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{recent.filter(r => r.status === 'PENDING RELEASE').length}</p>
              </div>
            </motion.div>

            {/* Quick actions */}
            <motion.div variants={item}>
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {quickActions.map((action) => (
                  <motion.button
                    key={action.type}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleAction(action.type)}
                    className="glass rounded-xl p-4 text-left cursor-pointer group transition-all duration-300 hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)]"
                  >
                    <div className={`w-10 h-10 rounded-lg ${action.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <action.icon className={`w-5 h-5 ${action.color}`} />
                    </div>
                    <h4 className="text-sm font-bold text-[var(--text-primary)]">{action.label}</h4>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1 line-clamp-2">{action.sub}</p>
                    <ArrowUpRight className="w-4 h-4 text-[var(--text-muted)] mt-2 group-hover:text-[var(--text-primary)] transition-colors" />
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Recent Submissions */}
            <motion.div variants={item}>
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-3">
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Recent Submissions</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider 
                      ${syncStatus === 'syncing' ? 'bg-primary-500/10 text-primary-500 animate-pulse' : 
                        syncStatus === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 
                        syncStatus === 'error' ? 'bg-danger-500/10 text-danger-500' : 'bg-[var(--bg-sidebar)] text-[var(--text-muted)]'}`}>
                      {syncStatus === 'syncing' && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                      {syncStatus === 'success' && <CheckCircle2 className="w-2.5 h-2.5" />}
                      {syncStatus === 'error' && <AlertCircle className="w-2.5 h-2.5" />}
                      {syncStatus === 'idle' ? 'Ready' : syncStatus}
                    </span>
                    {syncError && <span className="text-danger-500 text-[10px] italic">({syncError})</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {syncing && <RefreshCw className="w-3 h-3 text-primary-500 animate-spin" />}
                  <button 
                    onClick={handleSync} 
                    disabled={syncing}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    Sync with Sheet
                  </button>
                  <button onClick={() => navigate('/history')} className="text-xs font-medium text-[var(--text-secondary)] hover:text-primary-500 transition-colors">View all</button>
                </div>
              </div>
              
              <div className="glass rounded-xl overflow-x-auto border border-[var(--border-subtle)]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      <th className="p-4 font-semibold">ID</th>
                      <th className="p-4 font-semibold">Sample Name</th>
                      <th className="p-4 font-semibold">Type</th>
                      <th className="p-4 font-semibold">Submitted By</th>
                      <th className="p-4 font-semibold">Date</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] text-sm">
                    {recent.length > 0 ? recent.slice(0, 6).map((entry) => (
                      <tr key={entry.id} className="hover:bg-[var(--bg-hover)] transition-colors group">
                        <td className="p-4 text-[var(--text-secondary)] font-mono text-xs">{entry.controlNumber}</td>
                        <td className="p-4 font-medium text-[var(--text-primary)]">{entry.sampleName}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider
                            ${entry.sampleType === 'ENVI' ? 'bg-emerald-500/10 text-emerald-500' :
                              entry.sampleType === 'WATER' ? 'bg-blue-500/10 text-blue-500' :
                              'bg-violet-500/10 text-violet-500'}`}>
                            {entry.sampleType}
                          </span>
                        </td>
                        <td className="p-4 flex items-center gap-2 text-[var(--text-secondary)]">
                          <div className="w-6 h-6 rounded-full bg-primary-500/20 text-primary-500 flex items-center justify-center text-[10px] font-bold">
                            {(entry.submittedBy || 'U')[0].toUpperCase()}
                          </div>
                          {entry.submittedBy || 'Unknown'}
                        </td>
                        <td className="p-4 text-[var(--text-secondary)] text-xs">{new Date(entry.submittedAt).toLocaleDateString()}</td>
                        <td className="p-4">{statusBadge(entry.status)}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="relative inline-block text-left">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEntry(selectedEntry === entry.id ? null : entry.id);
                              }}
                              className="p-1 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-[var(--text-muted)]"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            
                            {selectedEntry === entry.id && (
                              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] shadow-xl z-50 py-1">
                                <button 
                                  onClick={() => navigate(`/results?sampleId=${entry.id}`)}
                                  className="w-full text-left px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Log Results
                                </button>
                                <button 
                                  onClick={() => navigate(`/history?id=${entry.id}`)}
                                  className="w-full text-left px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                  View Details
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-[var(--text-secondary)] text-sm">No recent submissions found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>

          {/* Right Sidebar */}
          <div className="w-full xl:w-80 flex-shrink-0 space-y-6">
            
            {/* Queue Summary */}
            <motion.div variants={item} className="glass rounded-xl border border-[var(--border-subtle)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Queue Summary</h3>
                <button onClick={() => navigate('/history')} className="text-[10px] bg-[var(--bg-input)] px-2 py-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]">View all</button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"/> <span className="text-[var(--text-secondary)]">Pending Sync</span></div>
                  <span className="font-medium text-[var(--text-primary)]">{queueCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-cyan-500"/> <span className="text-[var(--text-secondary)]">In Progress</span></div>
                  <span className="font-medium text-[var(--text-primary)]">{stats.ongoing}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"/> <span className="text-[var(--text-secondary)]">In Incubation</span></div>
                  <span className="font-medium text-[var(--text-primary)]">{stats.upcoming + stats.dueToday}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-warning-500"/> <span className="text-[var(--text-secondary)]">For Review</span></div>
                  <span className="font-medium text-[var(--text-primary)]">{stats.pendingRelease}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-danger-500"/> <span className="text-[var(--text-secondary)]">Overdue</span></div>
                  <span className="font-medium text-danger-500">{stats.overdue}</span>
                </div>
              </div>
            </motion.div>

            {/* Upcoming Due */}
            <motion.div variants={item} className="glass rounded-xl border border-[var(--border-subtle)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Upcoming Due</h3>
                <button onClick={() => navigate('/incubation')} className="text-[10px] bg-[var(--bg-input)] px-2 py-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]">View all</button>
              </div>
              <div className="space-y-4">
                {upcomingTasks.length > 0 ? upcomingTasks.map(task => (
                  <div key={task.id} className="flex gap-3">
                    <div className="mt-0.5"><task.icon className={`w-4 h-4 ${task.color}`} /></div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{task.name}</p>
                      <p className={`text-xs mt-0.5 ${task.diffDays <= 0 ? 'text-danger-500 font-bold' : 'text-warning-500'}`}>
                        {task.diffDays === 0 ? 'Due Today' : task.diffDays < 0 ? `${Math.abs(task.diffDays)}d Overdue` : `Due in ${task.diffDays} days`}
                      </p>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-[var(--text-muted)] italic py-2">No upcoming duties.</p>
                )}
              </div>
            </motion.div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}
