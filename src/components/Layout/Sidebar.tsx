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
  FileSpreadsheet
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/new', icon: PlusCircle, label: 'New Sample' },
  { to: '/queue', icon: ListTodo, label: 'Queue' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/live', icon: FileSpreadsheet, label: 'Live Sheet' },
  { to: '/results', icon: FileText, label: 'Reports' },
  { to: '/incubation', icon: FlaskConical, label: 'Incubations' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  onLogout: () => void;
  queueCount: number;
}

export default function Sidebar({ onLogout, queueCount }: SidebarProps) {
  return (
    <aside
      className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0
                 bg-[var(--bg-sidebar)] backdrop-blur-xl border-r border-[var(--border-subtle)]
                 z-40"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-[var(--border-subtle)]">
        <div className="w-10 h-10 rounded-xl bg-[#00529b] overflow-hidden p-1.5 flex items-center justify-center shadow-lg border border-white/20">
          <img src="/unilever-logo.png" alt="Unilever" className="w-full h-full object-contain brightness-0 invert" />
        </div>
        <div>
          <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">Unilever Dashboard</h1>
          <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">QC Microbiology</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
              transition-all duration-200 group relative
              ${
                isActive
                  ? 'bg-primary-500/10 text-primary-500'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }
            `}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary-500"
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  />
                )}
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.to === '/queue' && queueCount > 0 && (
                  <span className="ml-auto bg-danger-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {queueCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-[var(--border-subtle)]">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
                     text-[var(--text-secondary)] hover:bg-danger-500/10 hover:text-danger-500
                     transition-all duration-200 w-full cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
