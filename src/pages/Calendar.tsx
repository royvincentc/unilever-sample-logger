import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, RefreshCw, CheckCircle2, AlertCircle, Clock,
  FlaskConical, Droplets, Package, Link2, ExternalLink, Info
} from 'lucide-react';
import Header from '../components/Layout/Header';
import { useTheme } from '../hooks/useTheme';
import { getHistory } from '../utils/db';
import type { HistoryEntry } from '../types';
import { auth } from '../utils/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// ===== INCUBATION SCHEDULES =====
interface IncubationEvent {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  sampleType: string;
  controlNumber: string;
  status: 'due-today' | 'upcoming' | 'overdue';
  colorClass: string;
}

function buildIncubationEvents(history: HistoryEntry[]): IncubationEvent[] {
  const events: IncubationEvent[] = [];
  const now = new Date();

  for (const entry of history) {
    const base = new Date(entry.dateSampled);
    if (isNaN(base.getTime())) continue;

    const addReading = (label: string, daysOffset: number) => {
      const due = new Date(base);
      due.setDate(due.getDate() + daysOffset);
      due.setHours(17, 0, 0, 0); // Default reminder at 5 PM

      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < -7) return; // Skip old ones

      const status: IncubationEvent['status'] =
        diffDays < 0 ? 'overdue' : diffDays === 0 ? 'due-today' : 'upcoming';

      events.push({
        id: `${entry.id}-${label}`,
        title: `${label} — ${entry.sampleName}`,
        description: `Control #: ${entry.controlNumber} | Type: ${entry.sampleType} | Submitted by: ${entry.submittedBy}`,
        startDate: due,
        endDate: new Date(due.getTime() + 60 * 60 * 1000),
        sampleType: entry.sampleType,
        controlNumber: entry.controlNumber,
        status,
        colorClass:
          status === 'overdue' ? 'text-danger-500 bg-danger-500/10' :
          status === 'due-today' ? 'text-amber-500 bg-amber-500/10' :
          'text-primary-500 bg-primary-500/10',
      });
    };

    if (entry.sampleType === 'ENVI') {
      addReading('ENVI Final Reading (48h)', 2);
    } else if (entry.sampleType === 'WATER') {
      addReading('WATER 1st Reading (48h)', 2);
      addReading('WATER 2nd Reading (7 Days)', 7);
      addReading('WATER Final Reading (14 Days)', 14);
    } else if (entry.sampleType === 'RawMats') {
      addReading('RawMats APC Initial (3 Days)', 3);
      addReading('RawMats APC Final (7 Days)', 7);
      addReading('RawMats M&Y Initial (5 Days)', 5);
      addReading('RawMats M&Y Final (7 Days)', 7);
    }
  }

  return events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

// ===== GOOGLE CALENDAR API =====
async function getCalendarAccessToken(): Promise<string | null> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/calendar.events');
    provider.setCustomParameters({ prompt: 'consent' });

    const result = await signInWithPopup(auth, provider);
    // @ts-ignore
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return credential?.accessToken ?? null;
  } catch (e) {
    console.error('Calendar token error:', e);
    return null;
  }
}

async function createCalendarEvent(accessToken: string, event: IncubationEvent): Promise<boolean> {
  try {
    const body = {
      summary: `🧪 ${event.title}`,
      description: event.description,
      start: {
        dateTime: event.startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: event.endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      colorId: event.status === 'overdue' ? '11' : event.status === 'due-today' ? '5' : '7',
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'email', minutes: 1440 },
        ],
      },
    };

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return res.ok;
  } catch {
    return false;
  }
}

// ===== PAGE COMPONENT =====
export default function Calendar() {
  const { theme, setTheme } = useTheme();
  const [events, setEvents] = useState<IncubationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: number; failed: number } | null>(null);
  const [syncError, setSyncError] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const history = await getHistory();
      setEvents(buildIncubationEvents(history));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleSyncToGoogleCalendar = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncError('');
    try {
      const token = await getCalendarAccessToken();
      if (!token) {
        setSyncError('Could not get Google Calendar access. Make sure you are signed in with Google.');
        setSyncing(false);
        return;
      }

      let success = 0;
      let failed = 0;
      for (const event of events) {
        const ok = await createCalendarEvent(token, event);
        if (ok) success++; else failed++;
      }
      setSyncResult({ success, failed });
    } catch (e: any) {
      setSyncError(e.message || 'Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const sampleIcon = (type: string) => {
    if (type === 'ENVI') return <FlaskConical className="w-4 h-4" />;
    if (type === 'WATER') return <Droplets className="w-4 h-4" />;
    return <Package className="w-4 h-4" />;
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const grouped = {
    overdue: events.filter((e) => e.status === 'overdue'),
    dueToday: events.filter((e) => e.status === 'due-today'),
    upcoming: events.filter((e) => e.status === 'upcoming'),
  };

  return (
    <div>
      <Header theme={theme} onSetTheme={setTheme} title="Calendar" />
      <div className="px-4 lg:px-8 max-w-3xl space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Incubation Calendar</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              One-way sync of incubation reminders to Google Calendar
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={loadEvents}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)]
                       text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </motion.button>
        </div>

        {/* Sync banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5 border border-[var(--border-subtle)]"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg flex-shrink-0">
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-[var(--text-primary)] text-sm">Sync to Google Calendar</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                Pushes all incubation reading reminders ({events.length} total) to your primary Google Calendar.
                This is <span className="font-semibold">one-way only</span> — data flows from this app to Google Calendar.
              </p>

              <AnimatePresence>
                {syncResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-500"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {syncResult.success} events synced successfully{syncResult.failed > 0 ? `, ${syncResult.failed} failed` : ''}!
                  </motion.div>
                )}
                {syncError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 flex items-start gap-2 text-xs text-danger-500"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {syncError}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSyncToGoogleCalendar}
                disabled={syncing || events.length === 0}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl
                           bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600
                           text-white text-sm font-bold shadow-lg shadow-blue-500/20
                           transition-all duration-200 cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                {syncing ? 'Syncing...' : `Sync ${events.length} Reminders`}
              </motion.button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex items-start gap-2 text-xs text-[var(--text-muted)]">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>You will be prompted to grant Google Calendar access when you sync for the first time. Events are added to your <strong>primary calendar</strong>.</p>
          </div>
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Overdue', count: grouped.overdue.length, color: 'text-danger-500', bg: 'bg-danger-500/10' },
            { label: 'Due Today', count: grouped.dueToday.length, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { label: 'Upcoming', count: grouped.upcoming.length, color: 'text-primary-500', bg: 'bg-primary-500/10' },
          ].map((s) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-4 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Event list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-7 h-7 text-primary-500 animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <CalendarDays className="w-12 h-12 text-[var(--text-muted)] mx-auto" />
            <p className="text-sm text-[var(--text-secondary)] font-medium">No incubation events found</p>
            <p className="text-xs text-[var(--text-muted)]">Submit samples first to generate incubation reminders</p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.overdue.length > 0 && (
              <EventSection title="⚠️ Overdue" events={grouped.overdue} sampleIcon={sampleIcon} formatDate={formatDate} />
            )}
            {grouped.dueToday.length > 0 && (
              <EventSection title="🔔 Due Today" events={grouped.dueToday} sampleIcon={sampleIcon} formatDate={formatDate} />
            )}
            {grouped.upcoming.length > 0 && (
              <EventSection title="📅 Upcoming" events={grouped.upcoming} sampleIcon={sampleIcon} formatDate={formatDate} />
            )}
          </div>
        )}

        <div className="pb-8" />
      </div>
    </div>
  );
}

function EventSection({
  title,
  events,
  sampleIcon,
  formatDate,
}: {
  title: string;
  events: IncubationEvent[];
  sampleIcon: (type: string) => React.ReactElement;
  formatDate: (d: Date) => string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
      <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider px-1">{title}</h3>
      {events.map((ev) => (
        <motion.div
          key={ev.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass rounded-2xl p-4 flex items-start gap-3"
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${ev.colorClass}`}>
            {sampleIcon(ev.sampleType)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug truncate">{ev.title}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">#{ev.controlNumber}</p>
            <div className="flex items-center gap-1 mt-1.5 text-xs text-[var(--text-muted)]">
              <Clock className="w-3 h-3" />
              {formatDate(ev.startDate)}
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
