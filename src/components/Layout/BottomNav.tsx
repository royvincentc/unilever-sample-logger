import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  ListTodo,
  Clock,
  Settings,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/new', icon: PlusCircle, label: 'New', primary: true },
  { to: '/queue', icon: ListTodo, label: 'Queue' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface BottomNavProps {
  queueCount: number;
}

export default function BottomNav({ queueCount }: BottomNavProps) {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40
                 bg-[var(--bg-sidebar)] backdrop-blur-xl
                 border-t border-[var(--border-subtle)]
                 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `
              flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl
              transition-all duration-200 relative min-w-[56px]
              ${item.primary ? '' : ''}
              ${
                isActive
                  ? 'text-primary-500'
                  : 'text-[var(--text-muted)]'
              }
            `}
          >
            {item.primary ? (
              <div className="w-12 h-12 -mt-5 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500
                              flex items-center justify-center shadow-lg shadow-primary-500/30">
                <item.icon className="w-6 h-6 text-white" />
              </div>
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
      </div>
    </nav>
  );
}
