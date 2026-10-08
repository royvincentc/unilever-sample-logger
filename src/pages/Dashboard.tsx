import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Plus, RefreshCw, Clock, UploadCloud, History, FileText, CalendarDays, BookOpen, FileSpreadsheet, ChevronRight } from 'lucide-react';
import Header from '../components/Layout/Header';
import NotificationPopup from '../components/ui/NotificationPopup';
import PatchNotesModal from '../components/ui/PatchNotesModal';
import ScienceGraphic from '../components/ui/ScienceGraphic';
import { auth } from '../utils/firebase';
import { getHistory, listenToHistory } from '../utils/db';
import { getUserName } from '../utils/auth';
import { fetchHistoryFromSheet } from '../utils/api';
import { useToast } from '../components/ui/Toast';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { reveal, stagger } from '../design/motion';
import type { HistoryEntry } from '../types';

interface DashboardProps {
  theme: 'light' | 'dark' | 'system';
  onSetTheme: (theme: 'light' | 'dark' | 'system') => void;
  queueCount: number;
}
const samples = [
  { type: 'ENVI', title: 'Environment', detail: 'Surfaces & swabs', kind: 'envi' as const },
  { type: 'WATER', title: 'Water', detail: 'Sources & sampling points', kind: 'water' as const },
  { type: 'RawMats', title: 'Materials', detail: 'Raw materials, FG & SFG', kind: 'rawmats' as const },
  { type: 'AIR', title: 'Air monitoring', detail: 'Air quality & settling plates', kind: 'air' as const },
];
const shortcuts = [
  { to: '/live', label: 'Live sheet', icon: FileSpreadsheet },
  { to: '/logbook', label: 'Logbook', icon: BookOpen },
  { to: '/results', label: 'Reports', icon: FileText },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
];
function ActivityStatus({ status }: { status: string }) {
  const style = status === 'ONGOING' || status === 'ON GOING' ? 'ongoing' : status === 'PENDING RELEASE' ? 'review' : status === 'RELEASED' || status === 'COMPLETED' ? 'done' : 'neutral';
  return <span className={`lab-status ${style}`}><span />{style === 'ongoing' ? 'In progress' : style === 'review' ? 'Awaiting review' : style === 'done' ? 'Completed' : status || 'Unspecified'}</span>;
}
export default function Dashboard({ theme, onSetTheme, queueCount }: DashboardProps) {
  const [recent, setRecent] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const { showToast } = useToast();
  const online = useOnlineStatus();
  const userName = getUserName();
  const loadData = useCallback(async () => {
    try { setRecent(await getHistory(50)); setLoadError(false); }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let liveUpdate = false;
    let disposed = false;
    let unsubscribeHistory: (() => void) | undefined;
    getHistory(50).then(data => { if (!disposed && !liveUpdate) setRecent(data); }).catch(() => { if (!disposed) setLoadError(true); }).finally(() => { if (!disposed) setLoading(false); });
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      unsubscribeHistory?.();
      if (user) unsubscribeHistory = listenToHistory(data => {
        liveUpdate = true;
        if (!disposed) { setRecent(data.slice(0, 50)); setLoadError(false); setLoading(false); }
      });
    });
    return () => { disposed = true; unsubscribeAuth(); unsubscribeHistory?.(); };
  }, []);
  const handleSync = async () => {
    setSyncing(true);
    try {
      const updated = await fetchHistoryFromSheet();
      await loadData();
      showToast(updated.length ? 'success' : 'info', updated.length ? 'Sync complete' : 'Up to date', updated.length ? `Updated ${updated.length} records` : 'No new records to sync');
    } catch { showToast('error', 'Sync failed', 'Could not reach the server. Your saved records are still available.'); }
    finally { setSyncing(false); }
  };
  const metrics = [
    { label: 'Recent logs', value: recent.length, detail: 'Latest 50 records', icon: History, to: '/history', tone: 'blue' },
    { label: 'Pending sync', value: queueCount, detail: 'Queued & failed submissions', icon: UploadCloud, to: '/queue', tone: 'amber' },
    { label: 'In progress', value: recent.filter(r => r.status === 'ONGOING' || r.status === 'ON GOING').length, detail: 'Within recent records', icon: Clock, to: '/incubation', tone: 'teal' },
    { label: 'Awaiting review', value: recent.filter(r => r.status === 'PENDING RELEASE').length, detail: 'Within recent records', icon: FileText, to: '/results', tone: 'violet' },
  ];
  return (
    <div className="lab-dashboard">
      <Header theme={theme} onSetTheme={onSetTheme} title="Dashboard" />
      <PatchNotesModal />
      <motion.div className="lab-page" variants={stagger} initial="hidden" animate="show">
        <motion.section variants={reveal} className="lab-hero">
          <div className="lab-hero-copy">
            <span className="lab-eyebrow"><span className="lab-dot" /> MICROBIOLOGY WORKSPACE</span>
            <h1>Your lab, <span>in focus.</span></h1>
            <p>Welcome back, {userName.split(' ')[0]}. Every sample, every step, in one place.</p>
            <div className="lab-hero-actions">
              <Link to="/new" className="lab-button primary"><Plus size={18} />New sample</Link>
              <button type="button" onClick={handleSync} disabled={syncing || !online} className="lab-button secondary" aria-busy={syncing}><RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />{syncing ? 'Syncing records…' : 'Sync records'}</button>
            </div>
          </div>
          <ScienceGraphic animated kind={syncing ? 'sync' : 'molecule'} className="lab-hero-art" />
          <div className="lab-connection" role="status"><span className={`lab-dot ${online ? '' : 'offline'}`} />{online ? 'Online' : 'Offline · saved on this device'}{queueCount > 0 && <Link to="/queue">{queueCount} pending sync <ChevronRight size={14} /></Link>}</div>
        </motion.section>
        <NotificationPopup userName={userName} />
        <motion.section variants={reveal} aria-label="Lab overview" className="lab-metrics">
          {metrics.map(metric => <Link className={`lab-metric ${metric.tone}`} to={metric.to} key={metric.label}>
            <div className="lab-metric-top"><span className="lab-icon"><metric.icon size={18} /></span><ArrowUpRight size={16} /></div>
            <p className="lab-metric-label">{metric.label}</p><strong>{loading ? '—' : metric.value}</strong><p className="lab-metric-detail">{metric.detail}</p>
          </Link>)}
        </motion.section>
        <div className="lab-dashboard-grid">
          <motion.section variants={reveal} className="lab-panel lab-activity">
            <div className="lab-section-heading"><div><span className="lab-eyebrow">SAMPLE TRACKING</span><h2>Recent activity</h2></div><Link className="lab-text-link" to="/history">View history <ArrowUpRight size={16} /></Link></div>
            {loadError ? <div className="lab-empty"><ScienceGraphic kind="offline" /><h3>Records unavailable</h3><p>We couldn’t load your recent records.</p><button className="lab-button secondary" onClick={loadData}>Try again</button></div> : loading ? <div className="lab-empty" role="status"><ScienceGraphic kind="sync" animated /><p>Loading recent records…</p></div> : recent.length ? <div className="lab-activity-list">
              <div className="lab-activity-columns"><span>Sample / control number</span><span>Logged</span><span>Status</span></div>
              {recent.slice(0, 6).map(entry => <div key={entry.id} className="lab-activity-row">
                <span className={`lab-sample-marker ${entry.sampleType.toLowerCase()}`}>{entry.sampleType === 'RawMats' ? 'RM' : entry.sampleType.slice(0, 1)}</span>
                <div className="lab-record-name"><h3>{entry.sampleName}</h3><p><span>{entry.controlNumber || 'Pending number'}</span> · {entry.sampleType}</p></div>
                <time dateTime={entry.submittedAt}>{new Date(entry.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}<small>{new Date(entry.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></time>
                <ActivityStatus status={entry.status} />
              </div>)}
            </div> : <div className="lab-empty"><ScienceGraphic kind="empty" /><h3>A fresh start</h3><p>Your logged samples will appear here.</p><Link to="/new" className="lab-button primary"><Plus size={16} />Log your first sample</Link></div>}
            <div className="lab-panel-footer"><span className="lab-dot" />Saved records, ready when you need them.</div>
          </motion.section>
          <motion.aside variants={reveal} className="lab-panel lab-sample-panel">
            <div className="lab-section-heading"><div><span className="lab-eyebrow">QUICK INTAKE</span><h2>Log a sample</h2></div><Plus size={18} /></div>
            {samples.map(sample => <Link key={sample.type} to={`/new?type=${sample.type}`} className={`lab-sample-action ${sample.kind}`}><ScienceGraphic kind={sample.kind} /><div><h3>{sample.title}</h3><p>{sample.detail}</p></div><ChevronRight size={16} /></Link>)}
            <Link className="lab-incubation-link" to="/incubation"><Clock size={18} /><span>Check incubation schedule</span><ArrowUpRight size={16} /></Link>
          </motion.aside>
        </div>
        <motion.section variants={reveal} aria-label="Workspace shortcuts" className="lab-shortcuts">{shortcuts.map(shortcut => <Link to={shortcut.to} key={shortcut.to}><shortcut.icon size={18} /><span>{shortcut.label}</span><ArrowUpRight size={16} /></Link>)}</motion.section>
        <p className="lab-workspace-footer">UNILEVER QC MICRO <span>Precision in every record.</span></p>
      </motion.div>
    </div>
  );
}
