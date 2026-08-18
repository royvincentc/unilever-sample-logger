import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, RefreshCw, CheckCircle2, AlertCircle, Clock,
  FlaskConical, Droplets, Package, Link2, Info
} from 'lucide-react';
import Header from '../components/Layout/Header';
import { useTheme } from '../hooks/useTheme';
import { getHistory } from '../utils/db';
import type { HistoryEntry } from '../types';
import { auth } from '../utils/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// React Big Calendar imports
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import type { View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': enUS,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// ===== INCUBATION SCHEDULES =====
interface IncubationEvent {
  id: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
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
      if (diffDays < -30) return; // Skip very old ones to keep calendar clean

      const status: IncubationEvent['status'] =
        diffDays < 0 ? 'overdue' : diffDays === 0 ? 'due-today' : 'upcoming';

      events.push({
        id: `${entry.id}-${label}`,
        title: `${entry.controlNumber} - ${label.split(' ')[0]}`,
        description: `Control #: ${entry.controlNumber}\nType: ${entry.sampleType}\nSubmitted by: ${entry.submittedBy}`,
        start: due,
        end: new Date(due.getTime() + 60 * 60 * 1000), // 1 hour duration
        sampleType: entry.sampleType,
        controlNumber: entry.controlNumber,
        status,
        colorClass:
          status === 'overdue' ? 'bg-danger-500' :
          status === 'due-today' ? 'bg-amber-500' :
          'bg-primary-500',
      });
    };

    if (entry.sampleType === 'ENVI') {
      addReading('ENVI Final (48h)', 2);
    } else if (entry.sampleType === 'WATER') {
      addReading('WATER 1st (48h)', 2);
      addReading('WATER 2nd (7D)', 7);
      addReading('WATER Final (14D)', 14);
    } else if (entry.sampleType === 'RawMats') {
      addReading('RM APC (3D)', 3);
      addReading('RM APC (7D)', 7);
      addReading('RM MY (5D)', 5);
      addReading('RM MY (7D)', 7);
    }
  }

  return events;
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
      start: { dateTime: event.start.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: event.end.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      colorId: event.status === 'overdue' ? '11' : event.status === 'due-today' ? '5' : '7',
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
    };
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || `HTTP ${res.status}`);
      }
      return true;
    } catch (err: any) {
      console.error('Failed to create calendar event:', err);
      throw err; // Re-throw to be caught by the sync handler
    }
  }

  // ===== CUSTOM COMPONENTS =====
  const CustomEvent = ({ event }: { event: IncubationEvent }) => (
    <div className={`p-1 text-[10px] md:text-xs font-bold leading-tight rounded text-white ${event.colorClass} truncate shadow-sm`}>
      {event.title}
    </div>
  );

  // ===== PAGE COMPONENT =====
  export default function Calendar() {
    const { theme, setTheme } = useTheme();
    const [events, setEvents] = useState<IncubationEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ success: number; failed: number } | null>(null);
    const [syncError, setSyncError] = useState('');
    
    const [view, setView] = useState<View>(Views.MONTH);
    const [date, setDate] = useState(new Date());

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
        let success = 0; let failed = 0;
        let lastError = '';
        for (const event of events.filter(e => e.start.getTime() > Date.now())) {
          try {
            const ok = await createCalendarEvent(token, event);
            if (ok) success++; else failed++;
          } catch (e: any) {
            failed++;
            lastError = e.message;
          }
        }
        setSyncResult({ success, failed });
        if (failed > 0 && lastError) {
          setSyncError(`Sync failed for some events: ${lastError}. Make sure the Calendar API scope is enabled in your Google Cloud Console.`);
        }
      } catch (e: any) {
        setSyncError(e.message || 'Sync failed. Please try again.');
      } finally {
        setSyncing(false);
      }
    };

  return (
    <div className="min-h-screen bg-[var(--bg-body)] flex flex-col">
      <Header theme={theme} onSetTheme={setTheme} title="Calendar" />
      <div className="px-4 lg:px-8 py-4 max-w-7xl mx-auto w-full flex-1 flex flex-col">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Incubation Schedule</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Track reading dates in a visual grid</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncToGoogleCalendar}
              disabled={syncing || events.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Link2 className="w-4 h-4" />
              {syncing ? 'Syncing...' : 'Sync to Google'}
            </button>
            <button
              onClick={loadEvents}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Sync Status Banner */}
        <AnimatePresence>
          {syncResult && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5" />
              <p className="text-sm font-bold">{syncResult.success} events synced successfully{syncResult.failed > 0 ? `, ${syncResult.failed} failed` : ''}!</p>
            </motion.div>
          )}
          {syncError && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6 p-4 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-500 flex items-center gap-3">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm font-bold">{syncError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Calendar Grid Container */}
        <div className="flex-1 glass rounded-2xl border border-[var(--border-subtle)] p-4 md:p-6 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
          
          <style dangerouslySetInnerHTML={{__html: `
            .rbc-calendar { font-family: inherit; }
            .rbc-month-view, .rbc-time-view, .rbc-agenda-view { border-color: var(--border-subtle); border-radius: 0.75rem; overflow: hidden; }
            .rbc-header { border-bottom-color: var(--border-subtle) !important; padding: 12px 4px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); font-weight: 800; border-left: none !important; }
            .rbc-day-bg { border-left-color: var(--border-subtle) !important; }
            .rbc-month-row { border-top-color: var(--border-subtle) !important; }
            .rbc-off-range-bg { background-color: var(--bg-body); opacity: 0.5; }
            .rbc-today { background-color: var(--bg-hover); }
            .rbc-date-cell { font-weight: 700; color: var(--text-primary); padding-right: 8px; padding-top: 4px; }
            .rbc-event { background: transparent !important; padding: 0 !important; }
            .rbc-button-link { color: inherit; font-weight: inherit; }
            .rbc-toolbar button { color: var(--text-secondary); border-color: var(--border-subtle); border-radius: 8px; font-weight: 700; padding: 6px 12px; margin: 0 4px; transition: all 0.2s; }
            .rbc-toolbar button:hover { background-color: var(--bg-hover); color: var(--text-primary); }
            .rbc-toolbar button.rbc-active { background-color: var(--text-primary); color: var(--bg-app); border-color: transparent; }
            .rbc-toolbar .rbc-toolbar-label { font-size: 1.25rem; font-weight: 900; color: var(--text-primary); }
          `}} />

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
          ) : (
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%', minHeight: '500px' }}
              views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
              view={view}
              date={date}
              onView={(v: any) => setView(v)}
              onNavigate={(d) => setDate(d)}
              components={{
                event: CustomEvent,
              }}
              popup
            />
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 pb-8">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-danger-500" /><span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Overdue</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Due Today</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary-500" /><span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Upcoming</span></div>
        </div>

      </div>
    </div>
  );
}
