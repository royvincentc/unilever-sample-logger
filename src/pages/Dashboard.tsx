import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical, Droplets, Package, Clock, AlertCircle, CalendarDays,
  UploadCloud, CheckCircle2, Search, RefreshCw, Plus, FileText, Settings, History
} from 'lucide-react';
import Header from '../components/Layout/Header';
import NotificationPopup from '../components/ui/NotificationPopup';
import { auth } from '../utils/firebase';
import { getHistory, importHistoryBatch, listenToHistory, getQueueItems } from '../utils/db';
import { getUserName } from '../utils/auth';
import { fetchHistoryFromSheet } from '../utils/api';
import { useToast } from '../components/ui/Toast';
import { useTheme } from '../hooks/useTheme';
import type { HistoryEntry } from '../types';

interface DashboardProps {
  theme: 'light' | 'dark' | 'system';
  onSetTheme: (theme: 'light' | 'dark' | 'system') => void;
  queueCount: number;
}

const liquidTransition = {
  type: 'spring' as const,
  stiffness: 200,
  damping: 20,
  mass: 1.2
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: liquidTransition }
};

export default function Dashboard({ theme, onSetTheme }: DashboardProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [recent, setRecent] = useState<HistoryEntry[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [isFabOpen, setIsFabOpen] = useState(false);
  
  const userName = getUserName();

  const loadData = useCallback(async () => {
    setSyncing(true);
    try {
      const history = await getHistory(50); // Just top 50 for dashboard speed
      setRecent(history);
      
      const items = await getQueueItems();
      setQueueCount(items.filter((i: any) => i.status === 'queued' || i.status === 'failed').length);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribeHistory: (() => void) | undefined;
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        unsubscribeHistory = listenToHistory((data) => {
          setRecent(data.slice(0, 20)); // Limit to 20 for pure minimal dashboard
          setSyncStatus('success');
        });
      } else {
        setSyncStatus('idle');
      }
    });

    loadData();
    return () => {
      unsubscribeAuth();
      if (unsubscribeHistory) unsubscribeHistory();
    };
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const externalHistory = await fetchHistoryFromSheet();
      if (externalHistory.length > 0) {
        loadData();
        showToast('success', 'Sync Complete', `Synced ${externalHistory.length} records`);
      } else {
        showToast('info', 'No New Data', 'Up to date');
      }
    } catch (error) {
      showToast('error', 'Sync Failed', 'Could not reach server');
    } finally {
      setSyncing(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'ONGOING' || status === 'ON GOING') return <span className="text-blue-500 font-bold flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"/>ONGOING</span>;
    if (status === 'PENDING RELEASE') return <span className="text-warning-500 font-bold flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-warning-500"/>REVIEW</span>;
    if (status === 'RELEASED' || status === 'COMPLETED') return <span className="text-emerald-500 font-bold flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>DONE</span>;
    return <span className="text-[var(--text-muted)] font-bold">{status}</span>;
  };

  const fabActions = [
    { id: 'envi', icon: FlaskConical, label: 'New ENVI', color: 'bg-emerald-500', route: '/new?type=ENVI' },
    { id: 'water', icon: Droplets, label: 'New WATER', color: 'bg-blue-500', route: '/new?type=WATER' },
    { id: 'rawmats', icon: Package, label: 'New RAWMATS', color: 'bg-violet-500', route: '/new?type=RawMats' },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-app)] overflow-hidden relative">
      <Header theme={theme} onSetTheme={onSetTheme} title="Dashboard" />
      <NotificationPopup userName={userName} />

      <div className="px-4 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto space-y-6 sm:space-y-8 lg:space-y-10">
        {/* Welcome Section */}
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 sm:gap-6">
          <div>
            <motion.h1 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[var(--text-primary)]"
            >
              Hello, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-cyan-500">{userName.split(' ')[0]}</span>.
            </motion.h1>
            <p className="text-[var(--text-secondary)] mt-1.5 text-sm sm:text-base font-medium">Ready to log some samples today?</p>
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-3 w-full md:w-auto">
            <button onClick={handleSync} disabled={syncing} className="glass px-3 sm:px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[var(--bg-hover)] active:scale-95 transition-all text-xs sm:text-sm font-bold text-[var(--text-primary)] flex-1 min-w-fit justify-center md:flex-none">
              <RefreshCw className={`w-4 h-4 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
            <button onClick={() => navigate('/results')} className="glass px-3 sm:px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[var(--bg-hover)] active:scale-95 transition-all text-xs sm:text-sm font-bold text-[var(--text-primary)] flex-1 min-w-fit justify-center md:flex-none">
              <FileText className="w-4 h-4 shrink-0" /> Results
            </button>
            <button onClick={() => navigate('/calendar')} className="glass px-3 sm:px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[var(--bg-hover)] active:scale-95 transition-all text-xs sm:text-sm font-bold text-[var(--text-primary)] flex-1 min-w-fit justify-center md:flex-none">
              <CalendarDays className="w-4 h-4 shrink-0" /> Calendar
            </button>
          </div>
        </motion.div>

        {/* Minimalist Overview Cards */}
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
          <div className="glass-strong rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary-500/10 rounded-full blur-2xl group-hover:bg-primary-500/20 transition-colors" />
            <div className="flex items-center gap-2.5 text-primary-500 mb-4">
              <History className="w-4.5 h-4.5" />
              <h3 className="font-bold text-xs tracking-widest uppercase">History</h3>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl sm:text-5xl font-black text-[var(--text-primary)]">{recent.length}</p>
                <p className="text-[var(--text-muted)] text-xs sm:text-sm font-medium mt-1">Recent Logs</p>
              </div>
              <button onClick={() => navigate('/history')} className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[var(--bg-hover)] flex items-center justify-center hover:bg-primary-500 hover:text-white active:scale-90 transition-all">
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          <div className="glass-strong rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-warning-500/10 rounded-full blur-2xl group-hover:bg-warning-500/20 transition-colors" />
            <div className="flex items-center gap-2.5 text-warning-500 mb-4">
              <UploadCloud className="w-4.5 h-4.5" />
              <h3 className="font-bold text-xs tracking-widest uppercase">Offline Queue</h3>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl sm:text-5xl font-black text-[var(--text-primary)]">{queueCount}</p>
                <p className="text-[var(--text-muted)] text-xs sm:text-sm font-medium mt-1">Pending Sync</p>
              </div>
              <button onClick={() => navigate('/queue')} className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[var(--bg-hover)] flex items-center justify-center hover:bg-warning-500 hover:text-white active:scale-90 transition-all">
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          <div className="glass-strong rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform sm:col-span-2 md:col-span-1">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-colors" />
            <div className="flex items-center gap-2.5 text-cyan-500 mb-4">
              <Clock className="w-4.5 h-4.5" />
              <h3 className="font-bold text-xs tracking-widest uppercase">Incubation</h3>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl sm:text-5xl font-black text-[var(--text-primary)]">{recent.filter(r => r.status === 'ONGOING' || r.status === 'ON GOING').length}</p>
                <p className="text-[var(--text-muted)] text-xs sm:text-sm font-medium mt-1">Active Samples</p>
              </div>
              <button onClick={() => navigate('/incubation')} className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[var(--bg-hover)] flex items-center justify-center hover:bg-cyan-500 hover:text-white active:scale-90 transition-all">
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Minimal Recent List */}
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="glass-strong rounded-2xl p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">Recent Activity</h2>
            <button onClick={() => navigate('/history')} className="text-primary-500 text-xs sm:text-sm font-bold hover:underline">View All</button>
          </div>

          <div className="space-y-2 sm:space-y-3 max-h-[55vh] overflow-y-auto custom-scrollbar">
            {recent.length > 0 ? recent.slice(0, 5).map(entry => (
              <div key={entry.id} className={`group flex items-center justify-between p-3 sm:p-4 rounded-xl hover:bg-[var(--bg-hover)] transition-all cursor-pointer border-l-[3px] ${
                entry.sampleType === 'ENVI' ? 'border-l-emerald-500' :
                entry.sampleType === 'WATER' ? 'border-l-blue-500' :
                'border-l-violet-500'
              }`}>
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-md shrink-0 ${
                    entry.sampleType === 'ENVI' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' :
                    entry.sampleType === 'WATER' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                    'bg-gradient-to-br from-violet-400 to-violet-600'
                  }`}>
                    {entry.sampleType === 'ENVI' ? <FlaskConical className="w-4 h-4 sm:w-5 sm:h-5"/> : entry.sampleType === 'WATER' ? <Droplets className="w-4 h-4 sm:w-5 sm:h-5"/> : <Package className="w-4 h-4 sm:w-5 sm:h-5"/>}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[var(--text-primary)] font-bold text-sm sm:text-base truncate">{entry.sampleName}</h4>
                    <p className="text-[var(--text-secondary)] text-[10px] sm:text-xs font-mono mt-0.5 truncate">{entry.controlNumber} · {new Date(entry.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-6 shrink-0 ml-2">
                  <div className="text-right hidden sm:block">
                    <p className="text-[var(--text-primary)] text-sm font-medium">{new Date(entry.submittedAt).toLocaleDateString()}</p>
                    <p className="text-[var(--text-muted)] text-xs">{new Date(entry.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="w-20 sm:w-24 flex justify-end text-xs">
                    {statusBadge(entry.status as string)}
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-8 sm:py-12 text-[var(--text-muted)] font-medium">No recent activity found.</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Fluid Floating Action Button (FAB) */}
      <div className="hidden lg:block fixed bottom-8 right-8 z-50">
        <AnimatePresence>
          {isFabOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.8 }}
              className="absolute bottom-20 right-0 flex flex-col gap-3 items-end"
            >
              {fabActions.map((action, i) => (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: i * 0.05 } }}
                  exit={{ opacity: 0, x: 20 }}
                  onClick={() => navigate(action.route)}
                  className="flex items-center gap-3 group"
                >
                  <span className="glass px-3 py-1.5 rounded-lg text-sm font-bold text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {action.label}
                  </span>
                  <div className={`w-12 h-12 rounded-full ${action.color} text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform`}>
                    <action.icon className="w-5 h-5" />
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsFabOpen(!isFabOpen)}
          className="w-16 h-16 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-2xl shadow-primary-500/30 relative overflow-hidden"
        >
          <motion.div animate={{ rotate: isFabOpen ? 45 : 0 }} transition={liquidTransition}>
            <Plus className="w-8 h-8" />
          </motion.div>
          {/* Liquid Ripple Effect background */}
          <div className="absolute inset-0 bg-white/20 rounded-full scale-0 group-hover:scale-150 transition-transform duration-500 origin-center" />
        </motion.button>
      </div>
    </div>
  );
}
