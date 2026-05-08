import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

interface DropdownProps {
  label: string;
  value: string;
  options: readonly string[] | string[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
}

export default function Dropdown({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select...',
  required = false,
  id,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-[var(--text-secondary)]">
        {label}
        {required && <span className="text-danger-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <button
          type="button"
          ref={btnRef}
          id={id}
          onClick={() => setOpen(!open)}
          className={`
            w-full flex items-center justify-between
            bg-[var(--bg-input)] border border-[var(--border-color)]
            rounded-xl px-4 py-3 text-left text-sm
            transition-all duration-200 cursor-pointer
            hover:border-[var(--color-primary-400)]
            ${open ? 'border-primary-500 ring-3 ring-primary-500/15' : ''}
            ${value ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}
          `}
        >
          <span className="truncate">{value || placeholder}</span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          </motion.span>
        </button>

        {createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={menuStyle}
                className="rounded-xl border border-[var(--border-color)]
                           bg-[var(--bg-card-solid)] shadow-xl max-h-72 overflow-y-auto"
              >
                {(options as string[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left
                      transition-colors duration-150 cursor-pointer
                      hover:bg-[var(--bg-hover)]
                      ${value === opt ? 'text-primary-500 font-medium bg-primary-50/50' : 'text-[var(--text-primary)]'}
                      first:rounded-t-xl last:rounded-b-xl
                    `}
                  >
                    {value === opt && <Check className="w-4 h-4 flex-shrink-0" />}
                    <span className={value === opt ? '' : 'ml-6'}>{opt}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </div>
    </div>
  );
}
