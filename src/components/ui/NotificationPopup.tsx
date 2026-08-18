import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, AlertCircle } from 'lucide-react';
import { getHistory } from '../../utils/db';
import type { HistoryEntry } from '../../types';

interface NotificationPopupProps {
  userName: string;
}

export default function NotificationPopup({ userName }: NotificationPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [hasDismissed, setHasDismissed] = useState(false);

  useEffect(() => {
    if (hasDismissed) return;

    const checkNotifications = async () => {
      try {
        const history = await getHistory(5000);
        // Only care about this user's or endorsed to this user
        const relevantHistory = history.filter(h => 
          h.submittedBy === userName || h.endorsedTo === userName
        );

        const newNotifs: string[] = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        relevantHistory.forEach(entry => {
          if (entry.status === 'RELEASED' || entry.status === 'COMPLETED') return;
          
          const baseDate = new Date(entry.dateAnalyzed || entry.dateSampled || entry.submittedAt);
          baseDate.setHours(0, 0, 0, 0);

          const checkCondition = (conditionDays: number, msg: string) => {
            const dueDate = new Date(baseDate);
            dueDate.setDate(dueDate.getDate() + conditionDays);
            const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) {
              newNotifs.push(`${entry.controlNumber} (${entry.sampleName}): ${msg}`);
            }
          };

          // Liquid Detergents / Fabric Conditioner (assuming RM / SFG)
          if (entry.sampleType === 'RawMats') {
            const sampleName = (entry.sampleName || '').toLowerCase();
            if (sampleName.includes('liquid') || sampleName.includes('detergent')) {
              checkCondition(3, 'Indicative reading due today (3 days)');
            } else if (sampleName.includes('fabric') || sampleName.includes('fabcon')) {
              checkCondition(5, 'Indicative reading due today (5 days)');
            }
          }

          // Water Reminders
          if (entry.sampleType === 'WATER') {
            checkCondition(2, '2nd day reading due today');
            checkCondition(7, '7th day reading due today');
            checkCondition(14, '14th day reading due today');
          }
        });

        if (newNotifs.length > 0) {
          setNotifications(newNotifs);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };

    checkNotifications();
  }, [userName, hasDismissed]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        className="fixed bottom-6 right-6 z-50 w-full max-w-sm glass-strong rounded-2xl shadow-2xl border border-[var(--border-subtle)] overflow-hidden"
      >
        <div className="bg-primary-500/10 px-4 py-3 flex items-center justify-between border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 text-primary-500">
            <Bell className="w-5 h-5 animate-bounce" />
            <span className="font-bold text-sm tracking-wider uppercase">Today's Reminders</span>
          </div>
          <button 
            onClick={() => {
              setIsOpen(false);
              setHasDismissed(true);
            }}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 max-h-[300px] overflow-y-auto custom-scrollbar space-y-3">
          {notifications.map((n, i) => (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              key={i} 
              className="flex items-start gap-3 bg-[var(--bg-hover)] p-3 rounded-xl border border-[var(--border-subtle)]"
            >
              <AlertCircle className="w-4 h-4 text-warning-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--text-primary)] leading-relaxed">{n}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
