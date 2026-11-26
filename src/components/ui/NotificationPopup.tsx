import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Bell, ChevronDown, ChevronRight } from 'lucide-react';
import { getHistory } from '../../utils/db';
import { dueReminders, type Reminder } from '../../utils/reminders';
import { localDateString } from '../../utils/date';
import { reveal, spring } from '../../design/motion';

const COLLAPSED_KEY = 'lab-reminders-collapsed';

/** Today's incubation readings for this analyst. Always shown, so "nothing due" is an answer rather than a missing panel. */
export default function NotificationPopup({ userName }: { userName: string }) {
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Collapsing lasts for the rest of the day; tomorrow's readings open it again.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === localDateString());

  useEffect(() => {
    let live = true;
    getHistory(5000)
      .then(history => { if (live) setReminders(dueReminders(history, userName)); })
      .catch(err => { console.error('Failed to fetch reminders:', err); if (live) setFailed(true); });
    return () => { live = false; };
  }, [userName]);

  const dueToday = reminders?.filter(r => r.inDays === 0).length ?? 0;
  const summary = failed ? "Couldn't check readings"
    : !reminders ? 'Checking incubation…'
    : dueToday ? `${dueToday} reading${dueToday === 1 ? '' : 's'} due today`
    : reminders.length ? 'No readings due today · more tomorrow' : 'No readings due today';

  const toggle = () => {
    if (collapsed) localStorage.removeItem(COLLAPSED_KEY);
    else localStorage.setItem(COLLAPSED_KEY, localDateString());
    setCollapsed(!collapsed);
  };

  return (
    <motion.section variants={reveal} className="lab-panel lab-reminders" aria-labelledby="reminders-title">
      <div className="lab-section-heading">
        <div className="lab-reminders-title">
          <motion.span
            className={`lab-icon ${dueToday ? 'due' : ''}`}
            animate={dueToday ? { rotate: [0, -16, 13, -9, 5, 0] } : { rotate: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: 'easeOut' }}
          ><Bell size={18} aria-hidden="true" /></motion.span>
          <div>
            <h2 id="reminders-title">Today's reminders</h2>
            <p aria-live="polite">{summary}</p>
          </div>
        </div>
        <div className="lab-reminders-tools">
          <Link to="/incubation" className="lab-text-link">Incubation <ChevronRight size={14} /></Link>
          {!!reminders?.length && (
            <button type="button" className="lab-reminders-toggle" onClick={toggle} aria-expanded={!collapsed} aria-controls="reminders-list" aria-label={collapsed ? 'Show reminders' : 'Hide reminders for today'}>
              <motion.span animate={{ rotate: collapsed ? -90 : 0 }} transition={spring.snap} style={{ display: 'grid' }}><ChevronDown size={18} /></motion.span>
            </button>
          )}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && !!reminders?.length && (
          <motion.ul id="reminders-list" className="lab-reminder-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {reminders.map(({ key, entry, reading, inDays }, i) => (
              <motion.li key={key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring.settle, delay: 0.1 + i * 0.05 }}>
                <Link to="/incubation" className="lab-reminder">
                  <span className={`lab-sample-marker ${entry.sampleType.toLowerCase()}`}>{entry.sampleType === 'RawMats' ? 'RM' : entry.sampleType.slice(0, 1)}</span>
                  <div className="lab-record-name">
                    <h3>{entry.sampleName}</h3>
                    <p><span>{entry.controlNumber || 'Pending number'}</span> · {reading}</p>
                  </div>
                  <span className={`lab-status ${inDays === 0 ? 'review' : ''}`}><span />{inDays === 0 ? 'Due today' : 'Tomorrow'}</span>
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
