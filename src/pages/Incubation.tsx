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
  Package,
  Filter
} from 'lucide-react';
import Header from '../components/Layout/Header';
import { useToast } from '../components/ui/Toast';
import { useTheme } from '../hooks/useTheme';
import { fetchActiveIncubationsFromSheet } from '../utils/api';

type IncubationCategory = 'Priority 1' | 'Priority 2' | 'Final';
type FilterTab = 'All' | 'Envi Swabs' | 'Water Samples' | 'Raw Materials' | 'Semi-Finished Goods (SFG)' | 'Finished Goods (FG)' | 'Air Monitoring';

interface IncubationTask {
  id: string;
  entryId: string;
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
  category: IncubationCategory;
  filterTab: FilterTab;
  analyzedBy: string;
  batchNumber?: string;
  qty?: string;
  unit?: string;
  apc?: string;
  my?: string;
  indicativeRemarks?: string;
  time?: string;
}

export default function Incubation() {
  const { theme, setTheme } = useTheme();
  const [tasks, setTasks] = useState<IncubationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('All');
  const [finalTab, setFinalTab] = useState<'All' | 'ENVI' | 'RM/SFG/FG' | 'WATER' | 'AIR'>('All');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const loadIncubations = useCallback(async () => {
    setLoading(true);
    try {
      const history = await fetchActiveIncubationsFromSheet();
      const now = new Date();
      // Normalize to start of day for accurate day differences
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const upcomingTasks: IncubationTask[] = [];

      history.forEach((entry) => {
        const baseDateStr = entry.dateAnalyzed || entry.dateSampled || entry.submittedAt;
        if (!baseDateStr) return;
        
        const baseDate = new Date(baseDateStr);
        if (isNaN(baseDate.getTime())) return;

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

        const createTask = (
          readingName: string, 
          daysToAdd: number, 
          icon: any, 
          colorClass: string, 
          bgClass: string,
          category: IncubationCategory,
          filterTab: FilterTab
        ) => {
          const dueDate = addDays(baseDate, daysToAdd);
          const { status, daysRemaining } = calculateStatus(dueDate);
          
          // Notification logic: auto-clears >3 days past due
          if (daysRemaining < -3) return;

          upcomingTasks.push({
            id: `${entry.id}-${readingName}`,
            entryId: entry.id,
            sampleName: entry.sampleName || '',
            controlNumber: entry.controlNumber || '',
            sampleType: entry.sampleType || '',
            readingName,
            dueDate,
            daysRemaining,
            status,
            icon,
            colorClass,
            bgClass,
            category,
            filterTab,
            analyzedBy: entry.submittedBy || 'Unknown Analyst',
            batchNumber: entry.batchNumber,
            qty: entry.qty,
            unit: entry.unit,
            apc: entry.apc,
            my: entry.my,
            indicativeRemarks: entry.indicativeRemarks,
            time: entry.time
          });
        };

        // Identify Sample Type for Tabs and logic
        const sName = (entry.sampleName || '').toLowerCase();
        
        if (entry.sampleType === 'ENVI') {
          createTask('Final (2D)', 2, FlaskConical, 'text-emerald-500', 'bg-emerald-500/10', 'Final', 'Envi Swabs');
        } else if (entry.sampleType === 'WATER') {
          createTask('Reading (14th)', 14, Droplets, 'text-indigo-500', 'bg-indigo-500/10', 'Final', 'Water Samples');
        } else if (entry.sampleType === 'AIR') {
          // Leave it empty unless they specify.
        } else if (entry.sampleType === 'RawMats') {
          let filterTab: FilterTab = 'Raw Materials';
          if (entry.rawMatsType === 'FG' || entry.rawMatsType === 'CUC') filterTab = 'Finished Goods (FG)';
          if (entry.rawMatsType === 'SFG') filterTab = 'Semi-Finished Goods (SFG)';
          
          const isFabCon = sName.includes('fabcon') || sName.includes('fabric conditioner') || sName.includes('fabric');
          
          if (isFabCon) {
            createTask('Indicative (5D)', 5, Package, 'text-violet-500', 'bg-violet-500/10', 'Priority 2', filterTab);
            createTask('Final (7D)', 7, Package, 'text-purple-500', 'bg-purple-500/10', 'Final', filterTab);
          } else {
            // Surf Liquid, Raw Materials, and any others
            createTask('Indicative (3D)', 3, Package, 'text-fuchsia-500', 'bg-fuchsia-500/10', 'Priority 1', filterTab);
            createTask('Final (7D)', 7, Package, 'text-pink-500', 'bg-pink-500/10', 'Final', filterTab);
          }
        }
      });

      // Sort by due date (closest first)
      upcomingTasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      setTasks(upcomingTasks);
    } catch (e) {
      console.error('Failed to load incubations from sheet:', e);
      showToast('error', 'Error', 'Failed to load incubation data from Google Sheets');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadIncubations();
  }, [loadIncubations]);

  const tabs: FilterTab[] = ['All', 'Envi Swabs', 'Water Samples', 'Raw Materials', 'Semi-Finished Goods (SFG)', 'Finished Goods (FG)', 'Air Monitoring'];

  // Categorized tasks for top panels (Only Due Today)
  const dueToday = tasks.filter(t => t.status === 'due-today' && (activeTab === 'All' || t.filterTab === activeTab));
  const priority1 = dueToday.filter(t => t.category === 'Priority 1');
  const priority2 = dueToday.filter(t => t.category === 'Priority 2');
  const finals = dueToday.filter(t => {
    if (t.category !== 'Final') return false;
    if (finalTab === 'All') return true;
    if (finalTab === 'ENVI') return t.filterTab === 'Envi Swabs';
    if (finalTab === 'WATER') return t.filterTab === 'Water Samples';
    if (finalTab === 'AIR') return t.filterTab === 'Air Monitoring';
    if (finalTab === 'RM/SFG/FG') return ['Raw Materials', 'Semi-Finished Goods (SFG)', 'Finished Goods (FG)'].includes(t.filterTab);
    return true;
  });

  // Bottom section: overdue and upcoming/all queues
  const filteredTasks = tasks.filter(t => activeTab === 'All' || t.filterTab === activeTab);
  const overdueTasks = filteredTasks.filter(t => t.status === 'overdue');
  const queueTasks = filteredTasks.filter(t => t.status !== 'overdue' && t.status !== 'due-today');

  const TaskCard = ({ task, isOverdue = false }: { task: IncubationTask, isOverdue?: boolean }) => (
    <div className={`p-3 rounded-xl border flex items-center justify-between group transition-all
      ${isOverdue ? 'bg-danger-500/5 border-danger-500/20 hover:border-danger-500/40' : 'glass border-[var(--border-subtle)] hover:border-[var(--text-muted)]'}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-lg ${task.bgClass} flex items-center justify-center flex-shrink-0`}>
          <task.icon className={`w-4 h-4 ${task.colorClass}`} />
        </div>
        <div className="min-w-0 py-1">
          <p className="text-sm font-black text-primary-500 font-mono truncate">
            {task.controlNumber}
          </p>
          <p className="text-xs font-bold text-[var(--text-primary)] truncate mt-0.5">
            {task.sampleName ? `${task.sampleName} - ` : ''}{task.readingName}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] text-[var(--text-secondary)] font-bold bg-[var(--bg-hover)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
              Analyzed by: {task.analyzedBy}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">
              &bull; Date Analyzed: {new Date(task.dueDate.getTime() - task.daysRemaining * 86400000 - (task.readingName.includes('2D') || task.readingName.includes('2nd') ? 2 : task.readingName.includes('3D') ? 3 : task.readingName.includes('5D') ? 5 : task.readingName.includes('7D') || task.readingName.includes('7th') ? 7 : task.readingName.includes('14') ? 14 : 0) * 86400000).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 pl-2">
        {isOverdue && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-danger-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> OVERDUE ({Math.abs(task.daysRemaining)}D)
            </span>
            {Math.abs(task.daysRemaining) === 3 && (
              <span className="text-[9px] text-[var(--text-muted)] mt-0.5">Auto-removing in &lt;24h</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => navigate(`/results?sampleId=${task.entryId}&readingName=${encodeURIComponent(task.readingName)}`)} className="p-1.5 hover:bg-[var(--bg-hover)] rounded-md text-[var(--text-secondary)] hover:text-primary-500 transition-colors cursor-pointer">
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const handleCopyReport = (dayTasks: IncubationTask[], day: number) => {
    if (dayTasks.length === 0) {
      showToast('info', 'No Data', `No indicative readings for Day ${day} today.`);
      return;
    }

    let text = `Indicative Result of Day ${day}\n`;
    dayTasks.forEach((task, index) => {
      let type = '';
      if (task.filterTab === 'Finished Goods (FG)') type = 'FG';
      else if (task.filterTab === 'Semi-Finished Goods (SFG)') type = 'SFG';
      else if (task.filterTab === 'Raw Materials') type = 'RM';

      const typePrefix = type ? `${type} - ` : '';
      const parts = [];
      if (task.batchNumber) parts.push(`BN: ${task.batchNumber}`);
      if (task.time) parts.push(`I ${task.time}`);
      
      let batchFull = '';
      if (parts.length > 0) {
        batchFull = `, ${parts.join(' ')}`;
      }
      
      const sizePart = task.qty && task.unit ? `, ${task.qty} ${task.unit}` : '';
      
      text += `${index + 1}. ${typePrefix}${task.sampleName}${batchFull}${sizePart}\n`;
      text += `APC: ${task.apc || 'N/A'}\n`;
      text += `MY: ${task.my || 'N/A'}\n`;
      text += `Remarks: ${task.indicativeRemarks || 'N/A'}\n`;
      if (index < dayTasks.length - 1) text += '\n';
    });

    navigator.clipboard.writeText(text)
      .then(() => showToast('success', 'Copied!', `Day ${day} report copied to clipboard.`))
      .catch(() => showToast('error', 'Error', 'Failed to copy to clipboard.'));
  };

  return (
    <div className="min-h-screen bg-[var(--bg-body)]">
      <Header theme={theme} onSetTheme={setTheme} title="Incubations" />
      
      <div className="px-4 lg:px-6 py-4 max-w-[1400px] mx-auto space-y-6">
        
        {/* Top Priority Panels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-4 border border-[var(--border-subtle)] flex flex-col h-full max-h-[400px]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Priority 1: 3rd Day Indicative Readings</h3>
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">(Due Today)</p>
              </div>
              <button 
                onClick={() => handleCopyReport(priority1, 3)}
                className="text-[10px] font-bold text-primary-500 bg-primary-500/10 px-2 py-1.5 rounded-lg hover:bg-primary-500/20 transition-colors cursor-pointer border border-primary-500/20"
                title="Copy Day 3 Report"
              >
                Copy Report
              </button>
            </div>
            <div className="text-3xl font-bold text-warning-500 mb-4">{priority1.length}</div>
            <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {priority1.map(t => <TaskCard key={t.id} task={t} />)}
            </div>
          </div>
          
          <div className="glass rounded-2xl p-4 border border-[var(--border-subtle)] flex flex-col h-full max-h-[400px]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Priority 2: 5th Day Indicative Readings</h3>
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">(Due Today)</p>
              </div>
              <button 
                onClick={() => handleCopyReport(priority2, 5)}
                className="text-[10px] font-bold text-primary-500 bg-primary-500/10 px-2 py-1.5 rounded-lg hover:bg-primary-500/20 transition-colors cursor-pointer border border-primary-500/20"
                title="Copy Day 5 Report"
              >
                Copy Report
              </button>
            </div>
            <div className="text-3xl font-bold text-danger-500 mb-4">{priority2.length}</div>
            <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {priority2.map(t => <TaskCard key={t.id} task={t} />)}
            </div>
          </div>

          <div className="glass rounded-2xl p-4 border border-[var(--border-subtle)] flex flex-col h-full max-h-[400px]">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Final & Multi-Stage Readings</h3>
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">(Due Today)</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 mb-3 overflow-x-auto hide-scrollbar pb-1">
              {['All', 'ENVI', 'RM/SFG/FG', 'WATER', 'AIR'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setFinalTab(tab as any)}
                  className={`text-[9px] font-bold px-2 py-1 rounded transition-colors cursor-pointer whitespace-nowrap
                    ${finalTab === tab 
                      ? 'bg-emerald-500 text-white shadow-sm' 
                      : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="text-3xl font-bold text-emerald-500 mb-4">{finals.length}</div>
            <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {finals.map(t => <TaskCard key={t.id} task={t} />)}
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer
                ${activeTab === tab 
                  ? 'bg-primary-500 text-white shadow-md' 
                  : 'bg-[var(--bg-sidebar)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Categorized Queues */}
          <div className="glass rounded-2xl p-5 border border-[var(--border-subtle)]">
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary-500" />
              Categorized Queues (Selected Tab: {activeTab})
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
              {loading ? (
                <div className="text-sm text-[var(--text-muted)] p-4 text-center">Loading live data from Google Sheets...</div>
              ) : queueTasks.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)] p-4 text-center border border-dashed border-[var(--border-subtle)] rounded-xl">
                  No upcoming readings in this category.
                </div>
              ) : (
                queueTasks.map(t => (
                  <div key={t.id} className="p-3 rounded-xl border border-[var(--border-subtle)] flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg ${t.bgClass} flex items-center justify-center flex-shrink-0`}>
                         <t.icon className={`w-4 h-4 ${t.colorClass}`} />
                      </div>
                      <div className="min-w-0 py-1">
                         <p className="text-sm font-black text-primary-500 font-mono truncate">{t.controlNumber}</p>
                         <p className="text-xs font-bold text-[var(--text-primary)] truncate mt-0.5">{t.sampleName ? `${t.sampleName} - ` : ''}{t.readingName}</p>
                         <div className="mt-1.5 flex items-center">
                           <span className="text-[9px] text-[var(--text-secondary)] font-bold bg-[var(--bg-hover)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                             Analyzed by: {t.analyzedBy}
                           </span>
                         </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--bg-body)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                        In {t.daysRemaining} Days
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Overdue Notification Intelligence */}
          <div className="glass rounded-2xl p-5 border border-[var(--border-subtle)] bg-danger-500/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-danger-500" />
                Overdue Notification Intelligence
              </h3>
              <div className="text-right">
                <p className="text-xs font-bold text-danger-500">Overdue {overdueTasks.length}</p>
                <p className="text-[9px] text-[var(--text-muted)]">Notif logic: Autoclears &gt;3 days past due</p>
              </div>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
              {overdueTasks.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)] p-4 text-center border border-dashed border-[var(--border-subtle)] rounded-xl opacity-70">
                  No overdue readings! Great job.
                </div>
              ) : (
                overdueTasks.map(t => <TaskCard key={t.id} task={t} isOverdue={true} />)
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
