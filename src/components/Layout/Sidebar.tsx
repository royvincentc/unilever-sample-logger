import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  PlusCircle,
  Clock,
  ListTodo,
  Settings,
  LogOut,
  FlaskConical,
  FileText,
  FileSpreadsheet,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/new', icon: PlusCircle, label: 'New Sample' },
  { to: '/queue', icon: ListTodo, label: 'Offline Queue' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/live', icon: FileSpreadsheet, label: 'Live Sheet' },
  { to: '/logbook', icon: BookOpen, label: 'Logbook' },
  { to: '/results', icon: FileText, label: 'Reports' },
  { to: '/incubation', icon: FlaskConical, label: 'Incubations' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  onLogout: () => void;
  queueCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ onLogout, queueCount, isCollapsed, onToggleCollapse, isMobileOpen, onMobileClose }: SidebarProps) {
  const sidebarClasses = `
    flex flex-col h-screen fixed left-0 top-0
    bg-[var(--bg-sidebar)] lg:bg-transparent border-r border-[var(--border-subtle)] z-50
    transition-all duration-300
    ${isCollapsed ? 'lg:w-20' : 'lg:w-[280px]'}
    ${isMobileOpen ? 'w-[280px] translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0 w-[280px] lg:w-auto'}
  `;

  return (
    <aside className={sidebarClasses}>
      {/* Collapse Toggle (Desktop only) */}
      <button 
        onClick={onToggleCollapse} 
        className="hidden lg:block absolute -right-3 top-6 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-full p-1.5 z-50 text-[var(--text-secondary)] hover:text-primary-500 shadow-sm"
      >
         {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
      
      {/* Mobile Close Button */}
      {isMobileOpen && onMobileClose && (
        <button 
          onClick={onMobileClose}
          className="lg:hidden absolute right-4 top-6 p-2 rounded-full bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-primary-500"
        >
          <X size={20} />
        </button>
      )}

      {/* Logo */}
      <div className={`flex items-center ${isCollapsed ? 'lg:justify-center px-4 lg:px-0' : 'gap-3 px-8'} py-8`}>
        <div className={`${isCollapsed ? 'lg:w-8 lg:h-8 w-12 h-12' : 'w-12 h-12'} flex items-center justify-center shrink-0 transition-all duration-300`}>
          <img src="/unilever-logo.png" alt="Unilever" className="w-full h-full object-contain brightness-0 invert" />
        </div>
        {(!isCollapsed || isMobileOpen) && (
          <div className="overflow-hidden whitespace-nowrap">
            <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-wider leading-none mb-1">Unilever</h1>
            <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-widest leading-none">DASHBOARD | QC MICRO</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => {
              if (isMobileOpen && onMobileClose) onMobileClose();
            }}
            className={({ isActive }) => `
              flex items-center ${isCollapsed ? 'lg:justify-center px-4 lg:px-0' : 'gap-4 px-4'} py-3 rounded-2xl text-sm font-bold tracking-wide
              transition-all duration-300 group relative overflow-hidden
              ${
                isActive
                  ? 'text-primary-500 bg-primary-500/10'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }
            `}
            title={isCollapsed ? item.label : undefined}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-2xl border border-primary-500/20"
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  />
                )}
                <item.icon className={`w-5 h-5 shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                {(!isCollapsed || isMobileOpen) && <span className="relative z-10 whitespace-nowrap">{item.label}</span>}
                {(!isCollapsed || isMobileOpen) && item.to === '/queue' && queueCount > 0 && (
                  <span className="ml-auto bg-warning-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black relative z-10 shadow-lg shadow-warning-500/30">
                    {queueCount}
                  </span>
                )}
                {(isCollapsed && !isMobileOpen) && item.to === '/queue' && queueCount > 0 && (
                  <span className="hidden lg:flex absolute top-2 right-2 bg-warning-500 text-white text-[8px] w-3 h-3 rounded-full items-center justify-center font-black shadow-lg shadow-warning-500/30">
                    {queueCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-4 py-6">
        <button
          onClick={onLogout}
          className={`flex items-center ${isCollapsed ? 'lg:justify-center px-4 lg:px-0' : 'justify-center gap-3 px-4'} py-3 rounded-2xl text-sm font-bold
                     text-[var(--text-secondary)] hover:bg-danger-500 hover:text-white
                     transition-all duration-300 w-full cursor-pointer shadow-none hover:shadow-xl hover:shadow-danger-500/30 group`}
          title={isCollapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0 transition-transform group-hover:-translate-x-1" />
          {(!isCollapsed || isMobileOpen) && <span className="whitespace-nowrap">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
