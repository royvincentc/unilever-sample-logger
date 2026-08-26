import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

interface ComboBoxProps {
  label: string;
  value: string;
  options: readonly string[] | string[];
  onChange: (value: string) => void;
  placeholder?: string;
  customPlaceholder?: string; // Kept for backwards compatibility but not used
  required?: boolean;
  id?: string;
}

export default function ComboBox({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select or type...',
  required = false,
  id,
}: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const filteredOptions = useMemo(() => {
    if (!open) return options as string[];
    const lower = inputValue.toLowerCase();
    if (!lower) return options as string[];
    return (options as string[]).filter((opt) => opt.toLowerCase().includes(lower));
  }, [options, inputValue, open]);

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const menuMaxHeight = 288;
    const openUpward = spaceBelow < menuMaxHeight && spaceAbove > spaceBelow;

    if (openUpward) {
      setMenuStyle({
        position: 'fixed',
        bottom: viewportHeight - rect.top + 6,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(menuMaxHeight, spaceAbove),
        zIndex: 9999,
      });
    } else {
      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(menuMaxHeight, spaceBelow),
        zIndex: 9999,
      });
    }
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
        containerRef.current && !containerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false);
        onChange(inputValue.trim());
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [inputValue, onChange]);

  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.dataset.scrollY = String(scrollY);
      return () => {
        document.body.style.overflow = '';
        delete document.body.dataset.scrollY;
      };
    }
  }, [open]);

  const handleSelect = (opt: string) => {
    setInputValue(opt);
    onChange(opt);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    onChange(e.target.value);
    if (!open) setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission
      setOpen(false);
      onChange(inputValue.trim());
    }
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="block text-sm font-medium text-[var(--text-secondary)]">
        {label}
        {required && <span className="text-danger-500 ml-0.5">*</span>}
      </label>

      <div className="relative">
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={`
            w-full flex items-center justify-between
            bg-[var(--bg-input)] border border-[var(--border-color)]
            rounded-xl px-4 py-3 text-left text-sm text-[var(--text-primary)]
            transition-all duration-200 focus:outline-none
            hover:border-[var(--color-primary-400)] placeholder:text-[var(--text-muted)]
            ${open ? 'border-primary-500 ring-2 ring-primary-500/15' : ''}
          `}
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-1"
        >
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="block">
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          </motion.span>
        </button>

        {createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="cb-backdrop"
                style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                onClick={() => {
                  setOpen(false);
                  onChange(inputValue.trim());
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            )}
            {open && (
              <motion.div
                key="cb-menu"
                ref={menuRef}
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={menuStyle}
                className="rounded-xl border border-[var(--border-color)]
                           bg-[var(--bg-card-solid)] shadow-xl overflow-y-auto
                           overscroll-contain"
                onTouchMove={(e) => e.stopPropagation()}
              >
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleSelect(opt)}
                      className={`
                        w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left
                        transition-colors duration-150 cursor-pointer
                        hover:bg-[var(--bg-hover)]
                        ${value === opt ? 'text-primary-500 font-medium bg-primary-50/50' : 'text-[var(--text-primary)]'}
                      `}
                    >
                      {value === opt && <Check className="w-4 h-4 flex-shrink-0" />}
                      <span className={value === opt ? '' : 'ml-6'}>{opt}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-[var(--text-muted)]">
                    Press enter or click away to use "{inputValue}"
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </div>
    </div>
  );
}
