import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, RefreshCw, CheckCircle2, AlertCircle, Clock,
  FlaskConical, Droplets, Package, Link2, Info, X
} from 'lucide-react';
import Header from '../components/Layout/Header';
import { useTheme } from '../hooks/useTheme';
import { fetchActiveIncubationsFromSheet } from '../utils/api';
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
  analyst: string;
}

function buildIncubationEvents(history: any[]): IncubationEvent[] {
  const eventsMap = new Map<string, IncubationEvent>();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const entry of history) {
    const baseDateStr = entry.dateAnalyzed || entry.dateSampled || entry.submittedAt;
    if (!baseDateStr) continue;

    const base = new Date(baseDateStr);
    if (isNaN(base.getTime())) continue;

    const addReading = (label: string, daysOffset: number) => {
      const due = new Date(base);
      due.setDate(due.getDate() + daysOffset);
      
      const dueStartOfDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      const diffDays = Math.round((dueStartOfDay.getTime() - today.getTime()) / 86400000);

      if (diffDays < -30) return; // Skip very old ones to keep calendar clean

      const status: IncubationEvent['status'] =
        diffDays < 0 ? 'overdue' : diffDays === 0 ? 'due-today' : 'upcoming';

      // Set it to 9am on that day
      due.setHours(9, 0, 0, 0);

      const colorClass = 
          entry.sampleType === 'ENVI' ? 'bg-emerald-500' :
          entry.sampleType === 'AIR' ? 'bg-yellow-500' :
          entry.sampleType === 'WATER' ? 'bg-blue-500' :
          'bg-pink-500'; // RM, SFG, FG

      const analystName = entry.submittedBy || 'Unknown';
      const sampleName = entry.sampleName || 'N/A';
      
      const key = `${entry.controlNumber}-${label}-${due.getTime()}`;
      if (eventsMap.has(key)) {
        const existing = eventsMap.get(key)!;
        existing.description += `\nSample: ${sampleName}`;
      } else {
        eventsMap.set(key, {
          id: `${entry.id || entry.controlNumber}-${label}`,
          title: `${entry.controlNumber} - ${label}`,
          description: `Control #: ${entry.controlNumber}\nType: ${entry.sampleType}\nAnalyst: ${analystName}\nSample: ${sampleName}`,
          start: due,
          end: new Date(due.getTime() + 60 * 60 * 1000), // 1 hour duration
          sampleType: entry.sampleType,
          controlNumber: entry.controlNumber,
          status,
          colorClass,
          analyst: analystName
        });
      }
    };

    const sName = (entry.sampleName || '').toLowerCase();
    
    if (entry.sampleType === 'ENVI') {
      addReading('Final (2D)', 2);
    } else if (entry.sampleType === 'WATER') {
      addReading('Reading (14th)', 14);
    } else if (entry.sampleType === 'AIR') {
      // Leave empty
    } else if (entry.sampleType === 'RawMats') {
      const isFabCon = sName.includes('fabcon') || sName.includes('fabric conditioner') || sName.includes('fabric');
      
      if (isFabCon) {
        addReading('Indicative (5D)', 5);
        addReading('Final (7D)', 7);
      } else {
        addReading('Indicative (3D)', 3);
        addReading('Final (7D)', 7);
      }
    }
  }

  return Array.from(eventsMap.values());
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

    const [selectedEvents, setSelectedEvents] = useState<IncubationEvent[] | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAnalyst, setSelectedAnalyst] = useState<string>('All Analysts');

    const uniqueAnalysts = useMemo(() => {
      const analysts = Array.from(new Set(events.map(e => e.analyst))).filter(Boolean);
      return ['All Analysts', ...analysts.sort()];
    }, [events]);

    const filteredEvents = useMemo(() => {
      if (selectedAnalyst === 'All Analysts') return events;
      return events.filter(e => e.analyst === selectedAnalyst);
    }, [events, selectedAnalyst]);

    // Keyboard shortcut to close modal
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isModalOpen) {
          setIsModalOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen]);

    const loadEvents = useCallback(async () => {
      setLoading(true);
      try {
        const history = await fetchActiveIncubationsFromSheet();
        setEvents(buildIncubationEvents(history));
      } catch (err) {
        console.error("Failed to load events", err);
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => { loadEvents(); }, [loadEvents]);

    const handleSelectDate = (selectedD: Date) => {
      const dayEvents = filteredEvents.filter(e => e.start.toDateString() === selectedD.toDateString());
      if (dayEvents.length > 0) {
        setSelectedEvents(dayEvents);
        setSelectedDate(selectedD);
        setIsModalOpen(true);
      }
    };

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
        for (const event of filteredEvents.filter(e => e.start.getTime() > Date.now())) {
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
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedAnalyst}
              onChange={(e) => setSelectedAnalyst(e.target.value)}
              className="px-4 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer appearance-none min-w-[140px]"
            >
              {uniqueAnalysts.map(analyst => (
                <option key={analyst} value={analyst}>{analyst}</option>
              ))}
            </select>
            <button
              onClick={handleSyncToGoogleCalendar}
              disabled={syncing || filteredEvents.length === 0}
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
              events={filteredEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%', minHeight: '500px' }}
              views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
              view={view}
              date={date}
              onView={(v: any) => setView(v)}
              onNavigate={(d) => setDate(d)}
              selectable={true}
              onSelectSlot={({ start }) => handleSelectDate(start)}
              onDrillDown={(date) => handleSelectDate(date)}
              onSelectEvent={(e) => {
                setSelectedEvents([e]);
                setSelectedDate(e.start);
                setIsModalOpen(true);
              }}
              components={{
                event: CustomEvent,
              }}
              popup
            />
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 pb-8">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">ENVI</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500" /><span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">AIR</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">WATER</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-pink-500" /><span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">RM / SFG / FG</span></div>
        </div>

      </div>

      {/* Modal Popup */}
      <AnimatePresence>
        {isModalOpen && selectedEvents && selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm fixed"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden my-8"
            >
              <div className="p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-body)] sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)]">
                      {selectedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </h3>
                    <p className="text-sm font-semibold text-[var(--text-secondary)] mt-1">{selectedEvents.length} Sample{selectedEvents.length === 1 ? '' : 's'} Due</p>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                {selectedEvents.map((evt, idx) => (
                  <div key={idx} className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                    <div className={`h-2 w-full ${evt.colorClass}`} />
                    <div className="p-4 bg-[var(--bg-body)]">
                      <h4 className="text-lg font-bold text-[var(--text-primary)] font-mono">{evt.controlNumber}</h4>
                      <p className="text-sm font-semibold text-[var(--text-secondary)] mt-1 mb-4">{evt.title.split(' - ')[1]}</p>
                      
                      <div className="space-y-2">
                        {evt.description.split('\n').map((line, i) => {
                          const [label, ...val] = line.split(':');
                          return (
                            <div key={i} className="flex flex-col bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-subtle)]/50">
                              <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">{label}</span>
                              <span className="text-sm font-medium text-[var(--text-primary)] mt-0.5">{val.join(':').trim()}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
