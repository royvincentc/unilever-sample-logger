import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  CalendarDays
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/new', icon: PlusCircle, label: 'New Sample' },
  { to: '/queue', icon: ListTodo, label: 'Offline Queue' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/live', icon: FileSpreadsheet, label: 'Live Sheet' },
  { to: '/results', icon: FileText, label: 'Reports' },
  { to: '/incubation', icon: FlaskConical, label: 'Incubations' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  onLogout: () => void;
  queueCount: number;
}

export default function Sidebar({ onLogout, queueCount }: SidebarProps) {
  return (
    <aside
      className="hidden lg:flex flex-col w-[280px] h-screen fixed left-0 top-0
                 bg-transparent border-r border-[var(--border-subtle)] z-40"
    >
      {/* Logo */}
      <div className="flex items-center gap-4 px-8 py-8">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00529b] to-[#00386b] overflow-hidden p-1.5 flex items-center justify-center shadow-2xl">
          <img src="/unilever-logo.png" alt="Unilever" className="w-full h-full object-contain brightness-0 invert" />
        </div>
        <div>
          <h1 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">Dashboard</h1>
          <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">QC Micro</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `
              flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold tracking-wide
              transition-all duration-300 group relative overflow-hidden
              ${
                isActive
                  ? 'text-primary-500 bg-primary-500/10'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }
            `}
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
                <item.icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="relative z-10">{item.label}</span>
                {item.to === '/queue' && queueCount > 0 && (
                  <span className="ml-auto bg-warning-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black relative z-10 shadow-lg shadow-warning-500/30">
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
          className="flex items-center justify-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold
                     text-[var(--text-secondary)] hover:bg-danger-500 hover:text-white
                     transition-all duration-300 w-full cursor-pointer shadow-none hover:shadow-xl hover:shadow-danger-500/30 group"
        >
          <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
