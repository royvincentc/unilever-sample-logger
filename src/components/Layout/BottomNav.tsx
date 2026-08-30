import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  ListTodo,
  Clock,
  Menu
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/new', icon: PlusCircle, label: 'New', primary: true },
  { to: '/queue', icon: ListTodo, label: 'Queue' },
];

interface BottomNavProps {
  queueCount: number;
  onMenuClick: () => void;
}

export default function BottomNav({ queueCount, onMenuClick }: BottomNavProps) {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40
                 bg-[var(--bg-sidebar)]/95 backdrop-blur-xl
                 border-t border-[var(--border-subtle)]
                 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-end justify-around px-2 py-2 max-w-lg mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `
              flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl
              transition-all duration-200 relative min-w-[52px]
              ${
                item.primary
                  ? isActive
                    ? 'text-white'
                    : 'text-white'
                  : isActive
                  ? 'text-primary-500'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }
            `}
          >
            {item.primary ? (
              <>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500
                                flex items-center justify-center shadow-lg shadow-primary-500/30">
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{item.label}</span>
              </>
            ) : (
              <>
                <div className="relative">
                  <item.icon className="w-5 h-5" />
                  {item.to === '/queue' && queueCount > 0 && (
                    <span className="absolute -top-1 -right-2 bg-danger-500 text-white text-[10px]
                                     w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {queueCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
        
        {/* Menu Button */}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl
                     transition-all duration-200 relative min-w-[52px]
                     text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <div className="relative">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-medium">Menu</span>
        </button>
      </div>
    </nav>
  );
}
