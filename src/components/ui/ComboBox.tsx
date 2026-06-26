import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, PenLine, X } from 'lucide-react';

interface ComboBoxProps {
  label: string;
  value: string;
  options: readonly string[] | string[];
  onChange: (value: string) => void;
  placeholder?: string;
  customPlaceholder?: string;
  required?: boolean;
  id?: string;
}

const CUSTOM_SENTINEL = '__custom__';

export default function ComboBox({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select...',
  customPlaceholder = 'Type name here...',
  required = false,
  id,
}: ComboBoxProps) {
  const isCustom = value !== '' && !(options as string[]).includes(value);
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(isCustom);
  const [customText, setCustomText] = useState(isCustom ? value : '');
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
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
        btnRef.current && !btnRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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

  // Focus the text input as soon as custom mode activates
  useEffect(() => {
    if (customMode) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [customMode]);

  const handleSelect = (opt: string) => {
    if (opt === CUSTOM_SENTINEL) {
      setCustomMode(true);
      setCustomText('');
      onChange('');
      setOpen(false);
    } else {
      setCustomMode(false);
      setCustomText('');
      onChange(opt);
      setOpen(false);
    }
  };

  const handleCustomConfirm = () => {
    const trimmed = customText.trim();
    if (trimmed) onChange(trimmed);
  };

  const handleClearCustom = () => {
    setCustomMode(false);
    setCustomText('');
    onChange('');
  };

  const displayValue = customMode ? customText : value;

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-[var(--text-secondary)]">
        {label}
        {required && <span className="text-danger-500 ml-0.5">*</span>}
      </label>

      {customMode ? (
        /* ── Free-text input mode ── */
        <div className="relative flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={customText}
            onChange={(e) => {
              setCustomText(e.target.value);
              onChange(e.target.value);
            }}
            onBlur={handleCustomConfirm}
            placeholder={customPlaceholder}
            className="
              w-full px-4 py-3 pr-10 rounded-xl
              bg-[var(--bg-input)] border border-primary-500
              ring-2 ring-primary-500/20
              text-sm text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)]
              focus:outline-none transition-all duration-200
            "
          />
          {/* Clear — go back to dropdown */}
          <button
            type="button"
            onClick={handleClearCustom}
            title="Back to list"
            className="
              absolute right-3 top-1/2 -translate-y-1/2
              text-[var(--text-muted)] hover:text-danger-500
              transition-colors cursor-pointer
            "
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* ── Normal dropdown mode ── */
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
              ${open ? 'border-primary-500 ring-2 ring-primary-500/15' : ''}
              ${displayValue ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}
            `}
          >
            <span className="truncate">{displayValue || placeholder}</span>
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
            </motion.span>
          </button>

          {createPortal(
            <AnimatePresence>
              {open && (
                <motion.div
                  key="cb-backdrop"
                  style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                  onClick={() => setOpen(false)}
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
                  {/* Regular options */}
                  {(options as string[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleSelect(opt)}
                      className={`
                        w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left
                        transition-colors duration-150 cursor-pointer
                        hover:bg-[var(--bg-hover)]
                        ${value === opt ? 'text-primary-500 font-medium bg-primary-50/50' : 'text-[var(--text-primary)]'}
                        first:rounded-t-xl
                      `}
                    >
                      {value === opt && <Check className="w-4 h-4 flex-shrink-0" />}
                      <span className={value === opt ? '' : 'ml-6'}>{opt}</span>
                    </button>
                  ))}

                  {/* Divider + custom option */}
                  <div className="border-t border-[var(--border-color)] mx-2 my-1" />
                  <button
                    type="button"
                    onClick={() => handleSelect(CUSTOM_SENTINEL)}
                    className="
                      w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left
                      transition-colors duration-150 cursor-pointer last:rounded-b-xl
                      hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]
                    "
                  >
                    <PenLine className="w-4 h-4 flex-shrink-0 text-primary-400" />
                    <span>Type custom name…</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}
        </div>
      )}
    </div>
  );
}
