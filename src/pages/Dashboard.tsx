import { useState, useEffect } from 'react';
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
  ListTodo
} from 'lucide-react';
import Header from '../components/Layout/Header';
import { getHistory } from '../utils/db';
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
  const [recent, setRecent] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    getHistory(10).then(setRecent);
  }, []);

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
              <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text-primary)]">{greeting}, Roy 👋</h1>
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Recent Submissions</h3>
                <button onClick={() => navigate('/history')} className="text-xs font-medium text-[var(--text-secondary)] hover:text-primary-500 transition-colors">View all</button>
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
                            R
                          </div>
                          Roy
                        </td>
                        <td className="p-4 text-[var(--text-secondary)] text-xs">{new Date(entry.submittedAt).toLocaleDateString()}</td>
                        <td className="p-4">{statusBadge(entry.status)}</td>
                        <td className="p-4 text-right">
                          <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 rounded hover:bg-[var(--bg-sidebar)]">
                            <MoreVertical className="w-4 h-4" />
                          </button>
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
                <button className="text-[10px] bg-[var(--bg-input)] px-2 py-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]">View all</button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"/> <span className="text-[var(--text-secondary)]">New Samples</span></div>
                  <span className="font-medium text-[var(--text-primary)]">5</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-cyan-500"/> <span className="text-[var(--text-secondary)]">In Progress</span></div>
                  <span className="font-medium text-[var(--text-primary)]">4</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"/> <span className="text-[var(--text-secondary)]">In Incubation</span></div>
                  <span className="font-medium text-[var(--text-primary)]">18</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-warning-500"/> <span className="text-[var(--text-secondary)]">For Review</span></div>
                  <span className="font-medium text-[var(--text-primary)]">7</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-danger-500"/> <span className="text-[var(--text-secondary)]">Overdue</span></div>
                  <span className="font-medium text-danger-500">2</span>
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
                <div className="flex gap-3">
                  <div className="mt-0.5"><Clock className="w-4 h-4 text-warning-500" /></div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">RO Water - Microbial Test</p>
                    <p className="text-xs text-warning-500 mt-0.5">Due in 2h 15m</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-0.5"><Clock className="w-4 h-4 text-warning-500" /></div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Chilled Water - Legionella</p>
                    <p className="text-xs text-warning-500 mt-0.5">Due in 4h 30m</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-0.5"><Clock className="w-4 h-4 text-warning-500" /></div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Production Swab - Line 3</p>
                    <p className="text-xs text-warning-500 mt-0.5">Due in 6h 45m</p>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}
