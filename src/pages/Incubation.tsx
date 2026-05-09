import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  Clock,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  Droplets,
  Package
} from 'lucide-react';
import Header from '../components/Layout/Header';
import { getHistory, listenToHistory, importHistoryBatch } from '../utils/db';
import { getUserName } from '../utils/auth';
import { fetchHistoryFromSheet } from '../utils/api';
import type { HistoryEntry } from '../types';

import { useTheme } from '../hooks/useTheme';

interface IncubationTask {
  id: string;
  sampleName: string;
  controlNumber: string;
  sampleType: string;
  readingName: string;
  dueDate: Date;
  daysRemaining: number;
  status: 'due-today' | 'overdue' | 'upcoming';
  icon: any;
  colorClass: string;
  bgClass: string;
}

export default function Incubation() {
  const { theme, setTheme } = useTheme();
  const [tasks, setTasks] = useState<IncubationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadIncubations = useCallback(async () => {
    const history = await getHistory(100);
    const currentUser = getUserName();
    const now = new Date();
    // Normalize to start of day for accurate day differences
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const upcomingTasks: IncubationTask[] = [];

    history.forEach((entry) => {
      // PERSONAL FILTER: Only show tasks for samples submitted by this user
      if (entry.submittedBy !== currentUser) return;
      // Use dateAnalyzed if available, fallback to dateSampled
      const baseDateStr = entry.dateAnalyzed || entry.dateSampled || entry.submittedAt;
      const baseDate = new Date(baseDateStr);
      // Normalize base date
      baseDate.setHours(0, 0, 0, 0);

      const addDays = (d: Date, days: number) => {
        const result = new Date(d);
        result.setDate(result.getDate() + days);
        return result;
      };

      const calculateStatus = (dueDate: Date) => {
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let status: 'due-today' | 'overdue' | 'upcoming' = 'upcoming';
        if (diffDays === 0) status = 'due-today';
        if (diffDays < 0) status = 'overdue';
        
        return { status, daysRemaining: diffDays };
      };

      const createTask = (readingName: string, daysToAdd: number, icon: any, colorClass: string, bgClass: string) => {
        const dueDate = addDays(baseDate, daysToAdd);
        const { status, daysRemaining } = calculateStatus(dueDate);
        
        // Skip tasks that are more than 7 days overdue (assume completed/forgotten)
        if (daysRemaining < -7) return;

        upcomingTasks.push({
          id: `${entry.id}-${readingName}`,
          sampleName: entry.sampleName || '',
          controlNumber: entry.controlNumber || '',
          sampleType: entry.sampleType || '',
          readingName,
          dueDate,
          daysRemaining,
          status,
          icon,
          colorClass,
          bgClass
        });
      };

      if (entry.sampleType === 'ENVI') {
        createTask('Final Reading (48h)', 2, FlaskConical, 'text-emerald-500', 'bg-emerald-500/10');
      } else if (entry.sampleType === 'WATER') {
        createTask('1st Reading (48h)', 2, Droplets, 'text-blue-500', 'bg-blue-500/10');
        createTask('2nd Reading (7 Days)', 7, Droplets, 'text-cyan-500', 'bg-cyan-500/10');
        createTask('Final Reading (14 Days)', 14, Droplets, 'text-indigo-500', 'bg-indigo-500/10');
      } else if (entry.sampleType === 'RawMats') {
        createTask('APC Initial (3 Days)', 3, Package, 'text-violet-500', 'bg-violet-500/10');
        createTask('APC Final (7 Days)', 7, Package, 'text-purple-500', 'bg-purple-500/10');
        createTask('MY Initial (5 Days)', 5, Package, 'text-fuchsia-500', 'bg-fuchsia-500/10');
        createTask('MY Final (7 Days)', 7, Package, 'text-pink-500', 'bg-pink-500/10');
      }
    });

    // Sort by due date
    upcomingTasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    setTasks(upcomingTasks);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadIncubations();
    const unsubscribe = listenToHistory(() => {
      loadIncubations();
    });
    
    // Background sync to ensure tasks are synced across devices
    const autoSync = async () => {
      try {
        const sheetHistory = await fetchHistoryFromSheet();
        if (sheetHistory.length > 0) {
          await importHistoryBatch(sheetHistory);
          loadIncubations();
        }
      } catch (e) {
        console.error('Incubation sync failed', e);
      }
    };
    autoSync();
  }, [loadIncubations]);

  const getStatusBadge = (task: IncubationTask) => {
    if (task.status === 'overdue') {
      return <span className="px-2 py-1 bg-danger-500/10 text-danger-500 text-[10px] font-bold rounded uppercase flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Overdue ({Math.abs(task.daysRemaining)}d)</span>;
    }
    if (task.status === 'due-today') {
      return <span className="px-2 py-1 bg-warning-500/10 text-warning-500 text-[10px] font-bold rounded uppercase flex items-center gap-1"><Clock className="w-3 h-3"/> Due Today</span>;
    }
    return <span className="px-2 py-1 bg-[var(--bg-hover)] text-[var(--text-secondary)] text-[10px] font-bold rounded uppercase">In {task.daysRemaining} days</span>;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-body)]">
      <Header theme={theme} onSetTheme={setTheme} title="Incubations" />
      
      <div className="px-4 lg:px-8 py-2 max-w-[1200px] mx-auto space-y-6">
        
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="glass rounded-xl p-4 border border-[var(--border-subtle)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Due Today</p>
            <p className="text-2xl font-bold text-warning-500">{tasks.filter(t => t.status === 'due-today').length}</p>
          </div>
          <div className="glass rounded-xl p-4 border border-[var(--border-subtle)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Overdue</p>
            <p className="text-2xl font-bold text-danger-500">{tasks.filter(t => t.status === 'overdue').length}</p>
          </div>
          <div className="glass rounded-xl p-4 border border-[var(--border-subtle)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Upcoming</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{tasks.filter(t => t.status === 'upcoming').length}</p>
          </div>
        </div>

        {/* Task List */}
        <div className="glass rounded-xl border border-[var(--border-subtle)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-primary-500" />
              Active Incubations
            </h3>
          </div>
          
          <div className="divide-y divide-[var(--border-subtle)]">
            {loading ? (
              <div className="p-8 text-center text-[var(--text-secondary)]">Loading incubations...</div>
            ) : tasks.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-50" />
                <p className="text-[var(--text-primary)] font-medium">All caught up!</p>
                <p className="text-sm text-[var(--text-muted)] mt-1">No active incubations to track.</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="p-4 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors group">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-lg ${task.bgClass} flex items-center justify-center flex-shrink-0`}>
                      <task.icon className={`w-5 h-5 ${task.colorClass}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-bold text-[var(--text-primary)]">{task.controlNumber}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">&bull;</span>
                        <span className="text-xs text-[var(--text-secondary)] truncate">{task.sampleName}</span>
                      </div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{task.readingName}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        Due: {task.dueDate.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {getStatusBadge(task)}
                    <button
                      onClick={() => navigate(`/results?sampleId=${task.id.split('-')[0]}&readingName=${encodeURIComponent(task.readingName)}`)}
                      className="text-[10px] font-bold uppercase text-primary-500 hover:text-primary-400 bg-primary-500/10 px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      Log Result
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
