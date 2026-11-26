import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import type { PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Plus, RefreshCw, Clock, UploadCloud, History, FileText, CalendarDays, BookOpen, FileSpreadsheet, ChevronRight } from 'lucide-react';
import Header from '../components/Layout/Header';
import NotificationPopup from '../components/ui/NotificationPopup';
import PatchNotesModal from '../components/ui/PatchNotesModal';
import ShiftSummaryModal from '../components/ui/ShiftSummaryModal';
import ScienceGraphic from '../components/ui/ScienceGraphic';
import ColonyPlate from '../components/dashboard/ColonyPlate';
import { auth } from '../utils/firebase';
import { getHistory, listenToHistory } from '../utils/db';
import { getUserName } from '../utils/auth';
import { fetchHistoryFromSheet } from '../utils/api';
import { useToast } from '../components/ui/Toast';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { item, motionTiming, panelTransition, reveal, revealGroup, spring, stagger } from '../design/motion';
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
const greeting = (hour = new Date().getHours()) => hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
function ActivityStatus({ status }: { status: string }) {
  const style = status === 'ONGOING' || status === 'ON GOING' ? 'ongoing' : status === 'PENDING RELEASE' ? 'review' : status === 'RELEASED' || status === 'COMPLETED' ? 'done' : 'neutral';
  const label = style === 'ongoing' ? 'In progress' : style === 'review' ? 'Awaiting review' : style === 'done' ? 'Completed' : status || 'Unspecified';
  // popLayout lets the old badge fade out in place while the new one fades in: a crossfade, not a swap.
  return <AnimatePresence mode="popLayout" initial={false}>
    <motion.span key={label} className={`lab-status ${style}`} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={panelTransition}><span />{label}</motion.span>
  </AnimatePresence>;
}
/** Counts through a MotionValue, so each frame updates the text node without a React render. */
function MetricValue({ value }: { value: number }) {
  const count = useMotionValue(0);
  const text = useTransform(count, latest => Math.round(latest));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { count.set(value); return; }
    const controls = animate(count, value, { duration: motionTiming.introduction * 2, ease: panelTransition.ease });
    return () => controls.stop();
  }, [count, value, reduced]);
  return <motion.span>{text}</motion.span>;
}
const activityColumns = <div className="lab-activity-columns"><span>Sample / control number</span><span>Logged</span><span>Status</span></div>;
const skeletonWidths = [64, 48, 72, 56, 68, 44];
/** Same markup and classes as a real row, so the panel keeps its height when records arrive. */
function SkeletonRow({ width }: { width: number }) {
  return <div className="lab-activity-row">
    <span className="lab-sample-marker lab-skeleton" />
    <div className="lab-record-name"><h3><span className="lab-skeleton lab-bar" style={{ width: `${width}%` }} /></h3><p><span className="lab-skeleton lab-bar" style={{ width: `${width * 0.6}%` }} /></p></div>
    <time><span className="lab-skeleton lab-bar" style={{ width: 44 }} /><small><span className="lab-skeleton lab-bar" style={{ width: 32 }} /></small></time>
    <span className="lab-status lab-skeleton" style={{ width: 84 }}>&nbsp;</span>
  </div>;
}
export default function Dashboard({ theme, onSetTheme, queueCount }: DashboardProps) {
  const [recent, setRecent] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const { showToast } = useToast();
  const online = useOnlineStatus();
  const userName = getUserName();
  // After the first rows render, later arrivals slide in from the top instead of staggering.
  const rowsShown = useRef(false);
  useEffect(() => { if (recent.length) rowsShown.current = true; });
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
    { label: 'Recent logs', value: recent.length, detail: 'Latest 50 records', icon: History, to: '/history' },
    { label: 'Pending sync', value: queueCount, detail: 'Queued & failed submissions', icon: UploadCloud, to: '/queue' },
    { label: 'In progress', value: recent.filter(r => r.status === 'ONGOING' || r.status === 'ON GOING').length, detail: 'Within recent records', icon: Clock, to: '/incubation' },
    { label: 'Awaiting review', value: recent.filter(r => r.status === 'PENDING RELEASE').length, detail: 'Within recent records', icon: FileText, to: '/results' },
  ];
  const firstName = userName.split(' ')[0];
  // Hero spotlight and plate parallax: mouse only, springs write transforms outside React renders.
  const reduced = useReducedMotion();
  const pointerX = useMotionValue(0), pointerY = useMotionValue(0);
  const driftX = useMotionValue(0), driftY = useMotionValue(0);
  const glowX = useSpring(pointerX, { stiffness: 220, damping: 28, mass: 0.5 });
  const glowY = useSpring(pointerY, { stiffness: 220, damping: 28, mass: 0.5 });
  const softX = useSpring(driftX, { stiffness: 90, damping: 20 });
  const softY = useSpring(driftY, { stiffness: 90, damping: 20 });
  const plateX = useTransform(softX, v => v * 24), plateY = useTransform(softY, v => v * 16);
  const track = (event: PointerEvent<HTMLElement>, entering = false) => {
    if (reduced || event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left, y = event.clientY - box.top;
    pointerX.set(x); pointerY.set(y);
    if (entering) { glowX.jump(x); glowY.jump(y); } // start under the cursor instead of sweeping in from the corner
    driftX.set(x / box.width - 0.5); driftY.set(y / box.height - 0.5);
  };
  return (
    <div className="lab-dashboard">
      <Header theme={theme} onSetTheme={onSetTheme} title="Dashboard" />
      <PatchNotesModal />
      <motion.div className="lab-page" variants={stagger} initial="hidden" animate="show">
        <motion.section variants={revealGroup} className="lab-hero" onPointerEnter={e => track(e, true)} onPointerMove={track} onPointerLeave={() => { driftX.set(0); driftY.set(0); }}>
          <motion.div className="lab-hero-glow" style={{ x: glowX, y: glowY }} aria-hidden="true" />
          <div className="lab-hero-copy">
            <motion.p variants={item} className="lab-hero-date">{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</motion.p>
            <motion.h1 variants={item}>{greeting()}{firstName ? `, ${firstName}` : ''}</motion.h1>
            <motion.p variants={item}>Here’s what’s happening in the lab today.</motion.p>
            <motion.div variants={item} className="lab-hero-actions">
              <Link to="/new" className="lab-button primary"><Plus size={18} />New sample</Link>
              <button type="button" onClick={handleSync} disabled={syncing || !online} className="lab-button secondary" aria-busy={syncing}><RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />{syncing ? 'Syncing records…' : 'Sync records'}</button>
              <ShiftSummaryModal />
            </motion.div>
          </div>
          <ColonyPlate entries={recent} online={online} style={{ x: plateX, y: plateY }} />
          <div className="lab-connection" role="status"><span className="lab-dot-wrap"><span className={`lab-dot ${online ? '' : 'offline'}`} />
            {/* One ping per new record (keyed by the newest id), not an idle loop. */}
            {online && recent[0] && <motion.span key={recent[0].id} className="lab-dot-ping" initial={{ scale: 1, opacity: 0.6 }} animate={{ scale: 3.2, opacity: 0 }} transition={{ duration: 1.2, ease: 'easeOut' }} />}
          </span>{online ? 'Online' : 'Offline · saved on this device'}{queueCount > 0 && <Link to="/queue">{queueCount} pending sync <ChevronRight size={14} /></Link>}</div>
        </motion.section>
        <NotificationPopup userName={userName} />
        <motion.section variants={stagger} aria-label="Lab overview" className="lab-metrics">
          {/* Entrance lives on a wrapper: Link's per-render merged ref would remount a motion.create(Link) and freeze it hidden. */}
          {metrics.map(metric => <motion.div variants={item} key={metric.label}><Link className="lab-metric" to={metric.to}>
            <div className="lab-metric-top"><p className="lab-metric-label">{metric.label}</p><metric.icon size={16} aria-hidden="true" /></div>
            <strong>{loading ? '—' : <MetricValue value={metric.value} />}</strong><p className="lab-metric-detail">{metric.detail}</p>
          </Link></motion.div>)}
        </motion.section>
        <div className="lab-dashboard-grid">
          <motion.section variants={reveal} className="lab-panel lab-activity">
            <div className="lab-section-heading"><h2>Recent activity</h2><Link className="lab-text-link" to="/history">View history <ArrowUpRight size={16} /></Link></div>
            {loadError ? <div className="lab-empty"><ScienceGraphic kind="offline" /><h3>Records unavailable</h3><p>We couldn’t load your recent records.</p><button className="lab-button secondary" onClick={loadData}>Try again</button></div> : loading ? <div className="lab-activity-list" role="status">
              <span className="sr-only">Loading recent records…</span>
              <div aria-hidden="true">{activityColumns}{skeletonWidths.map((width, index) => <SkeletonRow key={index} width={width} />)}</div>
            </div> : recent.length ? <div className="lab-activity-list">
              {activityColumns}
              <AnimatePresence mode="popLayout">{recent.slice(0, 6).map((entry, index) => <motion.div key={entry.id} layout="position" className="lab-activity-row"
                initial={{ opacity: 0, y: rowsShown.current ? -12 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: motionTiming.feedback } }}
                transition={{ ...spring.settle, delay: rowsShown.current ? 0 : index * 0.05, layout: spring.settle }}>
                <span className={`lab-sample-marker ${entry.sampleType.toLowerCase()}`}>{entry.sampleType === 'RawMats' ? 'RM' : entry.sampleType.slice(0, 1)}</span>
                <div className="lab-record-name"><h3>{entry.sampleName}</h3><p><span>{entry.controlNumber || 'Pending number'}</span> · {entry.sampleType}</p></div>
                <time dateTime={entry.submittedAt}>{new Date(entry.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}<small>{new Date(entry.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></time>
                <ActivityStatus status={entry.status} />
              </motion.div>)}</AnimatePresence>
            </div> : <div className="lab-empty"><ScienceGraphic kind="empty" /><h3>A fresh start</h3><p>Your logged samples will appear here.</p><Link to="/new" className="lab-button primary"><Plus size={16} />Log your first sample</Link></div>}
          </motion.section>
          <motion.aside variants={revealGroup} className="lab-panel lab-sample-panel">
            <div className="lab-section-heading"><h2>Log a sample</h2></div>
            {samples.map(sample => <motion.div variants={item} key={sample.type}><Link to={`/new?type=${sample.type}`} className={`lab-sample-action ${sample.kind}`}><ScienceGraphic kind={sample.kind} /><div><h3>{sample.title}</h3><p>{sample.detail}</p></div><ChevronRight size={16} /></Link></motion.div>)}
            <Link className="lab-incubation-link" to="/incubation"><Clock size={18} /><span>Check incubation schedule</span><ArrowUpRight size={16} /></Link>
          </motion.aside>
        </div>
        <motion.section variants={stagger} aria-label="Workspace shortcuts" className="lab-shortcuts">{shortcuts.map(shortcut => <motion.div variants={item} key={shortcut.to}><Link to={shortcut.to}><shortcut.icon size={18} /><span>{shortcut.label}</span><ArrowUpRight size={16} /></Link></motion.div>)}</motion.section>
      </motion.div>
    </div>
  );
}
