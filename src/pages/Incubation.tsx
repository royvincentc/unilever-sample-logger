import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  Clock,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  Droplets,
  Package,
  Filter,
  Send
} from 'lucide-react';
import MultiSelect from '../components/ui/MultiSelect';
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
  apc?: string;
  my?: string;
  indicativeRemarks?: string;
  time?: string;
  rawMatsType?: string;
  size?: string;
}

export default function Incubation() {
  const { theme, setTheme } = useTheme();
  const [tasks, setTasks] = useState<IncubationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('All');
  const [selectedAnalysts, setSelectedAnalysts] = useState<string[]>(['All']);
  const [reportDate, setReportDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  });
  const navigate = useNavigate();
  const { showToast } = useToast();

  const loadIncubations = useCallback(async () => {
    setLoading(true);
    try {
      const history = await fetchActiveIncubationsFromSheet();
      const [year, month, day] = reportDate.split('-').map(Number);
      const now = new Date(year, month - 1, day);
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
            apc: entry.apc,
            my: entry.my,
            indicativeRemarks: entry.indicativeRemarks,
            time: entry.time,
            rawMatsType: entry.rawMatsType
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
    } catch (error) {
      console.error('Error loading incubations:', error);
      showToast('error', 'Error', 'Failed to load incubations');
    } finally {
      setLoading(false);
    }
  }, [showToast, reportDate]);

  useEffect(() => {
    loadIncubations();
  }, [loadIncubations]);

  const tabs: FilterTab[] = ['All', 'Envi Swabs', 'Water Samples', 'Raw Materials', 'Semi-Finished Goods (SFG)', 'Finished Goods (FG)', 'Air Monitoring'];

  // Categorized tasks for top panels (Only Due Today)
  const dueTodayBase = tasks.filter(t => t.status === 'due-today' && (activeTab === 'All' || t.filterTab === activeTab));
  
  const uniqueAnalysts = Array.from(new Set(dueTodayBase.map(t => t.analyzedBy))).sort();
  
  const dueTodayFiltered = dueTodayBase.filter(t => 
    selectedAnalysts.length === 0 || selectedAnalysts.includes('All') || selectedAnalysts.includes(t.analyzedBy)
  );
  
  const priority1 = dueTodayFiltered.filter(t => t.category === 'Priority 1');
  const priority2 = dueTodayFiltered.filter(t => t.category === 'Priority 2');
  const finals = dueTodayFiltered.filter(t => t.category === 'Final');

  // Bottom section: overdue and upcoming/all queues
  const filteredTasks = tasks.filter(t => activeTab === 'All' || t.filterTab === activeTab);
  const overdueTasks = filteredTasks.filter(t => t.status === 'overdue');
  const queueTasks = filteredTasks.filter(t => t.status !== 'overdue' && t.status !== 'due-today');

  const TaskCard = ({ task, isOverdue = false }: { task: IncubationTask, isOverdue?: boolean }) => {
    // Determine priority color
    let badgeColor = 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]';
    let badgeText: string = task.category;
    if (task.category === 'Priority 1') { badgeColor = 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'; badgeText = 'Day 3'; }
    if (task.category === 'Priority 2') { badgeColor = 'bg-orange-500/10 text-orange-500 border-orange-500/20'; badgeText = 'Day 5'; }
    if (task.category === 'Final') { badgeColor = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'; badgeText = 'Final'; }

    return (
      <div 
        className={`p-3.5 rounded-xl border flex items-center justify-between group shadow-sm animate-fade-in
        ${isOverdue ? 'bg-danger-500/5 border-danger-500/20 hover:border-danger-500/40' : 'bg-[var(--bg-card)] border-[var(--border-subtle)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}`}>
        <div className="flex items-center gap-3.5 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[var(--bg-app)] border border-[var(--border-subtle)]`}>
            <task.icon className={`w-4 h-4 ${task.colorClass}`} />
          </div>
          <div className="min-w-0 py-0.5">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${badgeColor}`}>
                {badgeText}
              </span>
              <p className="text-sm font-medium text-[var(--text-primary)] font-mono truncate">
                {task.controlNumber}
              </p>
            </div>
            <p className="text-xs font-medium text-[var(--text-secondary)] truncate mb-1">
              {task.sampleName ? `${task.sampleName} - ` : ''}{task.readingName}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">
                {task.analyzedBy} &bull; {new Date(task.dueDate.getTime() - task.daysRemaining * 86400000 - (task.readingName.includes('2D') || task.readingName.includes('2nd') ? 2 : task.readingName.includes('3D') ? 3 : task.readingName.includes('5D') ? 5 : task.readingName.includes('7D') || task.readingName.includes('7th') ? 7 : task.readingName.includes('14') ? 14 : 0) * 86400000).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 pl-2">
          {isOverdue && (
            <div className="flex flex-col items-end">
              <span className="text-[11px] font-semibold text-danger-500 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> OVERDUE ({Math.abs(task.daysRemaining)}D)
              </span>
              {Math.abs(task.daysRemaining) === 3 && (
                <span className="text-[10px] text-danger-500/70 mt-0.5">Auto-removing in &lt;24h</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
            <button onClick={() => {
              let tab = 'ENVI';
              if (task.filterTab === 'Water Samples') tab = 'WATER';
              else if (['Raw Materials', 'Semi-Finished Goods (SFG)', 'Finished Goods (FG)'].includes(task.filterTab)) tab = 'RawMats';
              else if (task.filterTab === 'Air Monitoring') tab = 'AIR';
              navigate(`/results?tab=${tab}&search=${encodeURIComponent(task.controlNumber)}`);
            }} className="p-2 hover:bg-[var(--bg-hover)] rounded-full text-[var(--text-muted)] hover:text-emerald-500 transition-colors cursor-pointer">
              <CheckCircle2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const generateReportText = (dayTasks: IncubationTask[], day: number) => {
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 18) greeting = 'Good afternoon';

    if (dayTasks.length === 0) {
      return `${greeting}\n\nNo indicative readings for Day ${day} today.\n\nThank you.`;
    }

    let text = `${greeting}\n\nIndicative Result for Day ${day}\n`;

    dayTasks.forEach((task, index) => {
      let type = '';
      if (task.rawMatsType) {
        type = task.rawMatsType;
        if (type === 'ROH') type = 'RM';
        if (type === 'CUC') type = 'FG';
      } else {
        if (task.filterTab === 'Finished Goods (FG)') type = 'FG';
        else if (task.filterTab === 'Semi-Finished Goods (SFG)') type = 'SFG';
        else if (task.filterTab === 'Raw Materials') type = 'RM';
      }

      const typePrefix = type ? `${type}: ` : '';
      const sizeSuffix = task.size ? `, ${task.size}` : '';
      
      text += `${index + 1}. ${typePrefix}${task.sampleName}${sizeSuffix}\n`;
      
      if (task.batchNumber) {
        text += `Batch #: ${task.batchNumber}\n`;
      }
      
      text += `APC: ${task.apc || 'N/A'}\n`;
      text += `MY: ${task.my || 'N/A'}\n`;
      
      // Force Remarks to "Pass" if indicativeRemarks contains passed/pass, etc. Or just output as is.
      // In the example it's "Remarks: Pass". We will output exactly what the sheet has, but if it's "PASSED" we can format it as "Pass" if desired, but better to keep exactly what's there or normalize capitalization.
      const rawRemarks = (task.indicativeRemarks || 'N/A').trim();
      const formattedRemarks = rawRemarks.toUpperCase() === 'PASSED' ? 'Pass' : 
                               rawRemarks.toUpperCase() === 'PASS' ? 'Pass' : 
                               rawRemarks.toUpperCase() === 'FAILED' ? 'Fail' : 
                               rawRemarks.toUpperCase() === 'FAIL' ? 'Fail' : rawRemarks;

      text += `Remarks: ${formattedRemarks}\n\n`;
    });

    text += `Thank you.`;
    return text;
  };

  const handleCopyReport = (dayTasks: IncubationTask[], day: number) => {
    const text = generateReportText(dayTasks, day);
    
    navigator.clipboard.writeText(text)
      .then(() => showToast('success', 'Copied!', `Day ${day} report copied to clipboard.`))
      .catch(() => showToast('error', 'Error', 'Failed to copy to clipboard.'));
  };

  const handleSendTelegram = async (dayTasks: IncubationTask[], day: number) => {
    const text = generateReportText(dayTasks, day);

    try {
      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send to Telegram');
      }
      
      showToast('success', 'Sent!', `Day ${day} report sent to Telegram successfully.`);
    } catch (e: any) {
      console.error('Telegram send error:', e);
      showToast('error', 'Telegram Error', e.message);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <Header theme={theme} onSetTheme={setTheme} title="Incubations" />
      
      <div className="px-4 lg:px-6 py-4 max-w-[1400px] mx-auto space-y-6">
        
        {/* Top Controls */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-[var(--text-muted)]">Assume Date:</span>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-[var(--text-muted)]">Filter Analyst:</span>
              <MultiSelect
                values={selectedAnalysts}
                onChange={setSelectedAnalysts}
                options={[
                  { value: 'All', label: 'All Analysts' },
                  ...uniqueAnalysts.map(a => ({ value: a, label: a }))
                ]}
                className="w-48 z-40"
              />
            </div>
          </div>

          {/* Universal Filter Tabs */}
          <div className="flex items-center p-1 gap-1 overflow-x-auto hide-scrollbar bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl w-max max-w-full">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative whitespace-nowrap px-4 py-1.5 text-xs font-semibold transition-colors duration-200 cursor-pointer rounded-xl
                  ${activeTab === tab 
                    ? 'text-white' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="active-tab"
                    className="absolute inset-0 bg-primary-500 rounded-xl shadow-sm"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">{tab}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Top Priority Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-4 border flex flex-col h-full max-h-[400px]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Priority 1: 3rd Day Indicative Readings</h3>
                <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">(Due Today)</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleCopyReport(priority1, 3)}
                  className="text-[10px] font-semibold text-cyan-500 bg-cyan-500/10 px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/20 transition-colors cursor-pointer border border-cyan-500/20"
                  title="Copy Day 3 Report"
                >
                  Copy Report
                </button>
                <button 
                  onClick={() => handleSendTelegram(priority1, 3)}
                  className="text-[10px] font-semibold text-blue-500 bg-blue-500/10 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors cursor-pointer border border-blue-500/20 flex items-center gap-1.5"
                  title="Send Day 3 Report to Telegram"
                >
                  <Send className="w-3 h-3" />
                  Send
                </button>
              </div>
            </div>
            <div className="text-3xl font-bold text-cyan-500 mb-4">{priority1.length}</div>
            <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {priority1.map(t => <TaskCard key={t.id} task={t} />)}
            </div>
          </div>
          
          <div className="glass rounded-2xl p-4 border flex flex-col h-full max-h-[400px]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Priority 2: 5th Day Indicative Readings</h3>
                <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">(Due Today)</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleCopyReport(priority2, 5)}
                  className="text-[10px] font-semibold text-orange-500 bg-orange-500/10 px-2.5 py-1.5 rounded-lg hover:bg-orange-500/20 transition-colors cursor-pointer border border-orange-500/20"
                  title="Copy Day 5 Report"
                >
                  Copy Report
                </button>
                <button 
                  onClick={() => handleSendTelegram(priority2, 5)}
                  className="text-[10px] font-semibold text-blue-500 bg-blue-500/10 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors cursor-pointer border border-blue-500/20 flex items-center gap-1.5"
                  title="Send Day 5 Report to Telegram"
                >
                  <Send className="w-3 h-3" />
                  Send
                </button>
              </div>
            </div>
            <div className="text-3xl font-bold text-orange-500 mb-4">{priority2.length}</div>
            <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {priority2.map(t => <TaskCard key={t.id} task={t} />)}
            </div>
          </div>
        </div>

        {/* Final & Multi-Stage Readings Panel */}
        <div className="glass rounded-2xl p-4 border flex flex-col max-h-[400px]">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Final & Multi-Stage Readings</h3>
                <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">(Due Today)</p>
              </div>
            </div>
            <div className="text-3xl font-bold text-emerald-500 mb-4">{finals.length}</div>
            <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {finals.map(t => <TaskCard key={t.id} task={t} />)}
            </div>
          </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Categorized Queues */}
          <div className="glass rounded-2xl p-5 border">
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-[var(--text-muted)]" />
              Categorized Queues (Selected Tab: {activeTab})
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
              {loading ? (
                <div className="text-sm text-[var(--text-muted)] p-4 text-center">Loading live data from Google Sheets...</div>
              ) : queueTasks.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)] p-4 text-center border border-dashed border-[var(--border-subtle)] rounded-xl">
                  No upcoming readings in this category.
                </div>
              ) : queueTasks.map(t => <TaskCard key={t.id} task={t} />)}
            </div>
          </div>

          {/* Overdue Notification Intelligence */}
          <div className="glass bg-danger-500/5 rounded-2xl p-5 border border-danger-500/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-danger-500" />
                Overdue Notification Intelligence
              </h3>
              <div className="text-right">
                <p className="text-xs font-semibold text-danger-500">Overdue {overdueTasks.length}</p>
                <p className="text-[10px] text-danger-500/70 mt-0.5">Autoclears &gt;3 days past due</p>
              </div>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
              {overdueTasks.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)] p-4 text-center border border-dashed border-[var(--border-subtle)] rounded-xl opacity-70">
                  No overdue readings! Great job.
                </div>
              ) : overdueTasks.map(t => <TaskCard key={t.id} task={t} isOverdue={true} />)}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

