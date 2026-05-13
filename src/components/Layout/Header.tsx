import { Sun, Moon, Monitor } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeaderProps {
  theme: 'light' | 'dark' | 'system';
  onSetTheme: (theme: 'light' | 'dark' | 'system') => void;
  title?: string;
}

const themeOptions = [
  { value: 'light' as const, icon: Sun },
  { value: 'dark' as const, icon: Moon },
  { value: 'system' as const, icon: Monitor },
];

export default function Header({ theme, onSetTheme, title }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 px-4 lg:px-8 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00529b] overflow-hidden p-1 flex items-center justify-center shadow-md lg:hidden border border-white/20">
            <img src="/unilever-logo.png" alt="Unilever" className="w-full h-full object-contain brightness-0 invert" />
          </div>
          {title ? (
            <h2 className="text-xl lg:text-2xl font-bold text-[var(--text-primary)]">
              {title}
            </h2>
          ) : (
            <div className="lg:hidden">
              <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">Unilever</h1>
              <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">QC Microbiology</p>
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-card-solid)] border border-[var(--border-color)]">
          {themeOptions.map((opt) => (
            <motion.button
              key={opt.value}
              whileTap={{ scale: 0.9 }}
              onClick={() => onSetTheme(opt.value)}
              className={`
                relative p-2 rounded-lg transition-colors duration-200 cursor-pointer
                ${
                  theme === opt.value
                    ? 'text-primary-500'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }
              `}
            >
              {theme === opt.value && (
                <motion.div
                  layoutId="theme-active"
                  className="absolute inset-0 rounded-lg bg-primary-500/10"
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                />
              )}
              <opt.icon className="w-4 h-4 relative z-10" />
            </motion.button>
          ))}
        </div>
      </div>
    </header>
  );
}
