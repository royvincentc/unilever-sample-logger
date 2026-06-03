import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface DatePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  id?: string;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 220 : -220,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -220 : 220,
    opacity: 0,
  }),
};

export default function DatePicker({
  label,
  value,
  onChange,
  required = false,
  id,
}: DatePickerProps) {
  const today = useMemo(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
    };
  }, []);

  const parsedValue = useMemo(() => {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    return { year: y, month: m - 1, day: d };
  }, [value]);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsedValue?.year ?? today.year);
  const [viewMonth, setViewMonth] = useState(parsedValue?.month ?? today.month);
  const [direction, setDirection] = useState(0);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  // When opening, reset view to selected date or today
  useEffect(() => {
    if (open) {
      const target = parsedValue ?? today;
      setViewYear(target.year);
      setViewMonth(target.month);
      setDirection(0);
      setShowYearPicker(false);
    }
  }, [open, parsedValue, today]);

  // Position the popup
  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const panelHeight = 380;
    const panelWidth = 320;
    const spaceBelow = viewportHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUpward = spaceBelow < panelHeight && spaceAbove > spaceBelow;

    let left = rect.left;
    if (left + panelWidth > viewportWidth - 12) {
      left = viewportWidth - panelWidth - 12;
    }
    if (left < 12) left = 12;

    if (openUpward) {
      setPanelStyle({
        position: 'fixed',
        bottom: viewportHeight - rect.top + 6,
        left,
        width: panelWidth,
        zIndex: 9999,
      });
    } else {
      setPanelStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        left,
        width: panelWidth,
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

  // Body scroll lock
  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [open]);

  const navigateMonth = useCallback((delta: number) => {
    setDirection(delta);
    setViewMonth((prev) => {
      let newMonth = prev + delta;
      if (newMonth > 11) {
        setViewYear((y) => y + 1);
        newMonth = 0;
      } else if (newMonth < 0) {
        setViewYear((y) => y - 1);
        newMonth = 11;
      }
      return newMonth;
    });
  }, []);

  const selectDate = useCallback(
    (day: number) => {
      onChange(toDateString(viewYear, viewMonth, day));
      setOpen(false);
    },
    [viewYear, viewMonth, onChange],
  );

  const selectYear = useCallback(
    (year: number) => {
      setDirection(year > viewYear ? 1 : year < viewYear ? -1 : 0);
      setViewYear(year);
      setShowYearPicker(false);
    },
    [viewYear],
  );

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const daysInPrevMonth = getDaysInMonth(
      viewMonth === 0 ? viewYear - 1 : viewYear,
      viewMonth === 0 ? 11 : viewMonth - 1,
    );

    const cells: Array<{ day: number; currentMonth: boolean }> = [];

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ day: daysInPrevMonth - i, currentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, currentMonth: true });
    }

    // Next month leading days
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, currentMonth: false });
    }

    return cells;
  }, [viewYear, viewMonth]);

  // Year picker range
  const yearRange = useMemo(() => {
    const startYear = viewYear - 7;
    const years: number[] = [];
    for (let y = startYear; y <= startYear + 15; y++) {
      years.push(y);
    }
    return years;
  }, [viewYear]);

  const displayValue = value ? formatDate(value) : '';

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
            ${displayValue ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}
          `}
        >
          <span className="truncate">{displayValue || 'Select date...'}</span>
          <Calendar className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
        </button>

        {createPortal(
          <AnimatePresence>
            {open && (
              <>
                {/* Invisible backdrop */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                  onClick={() => setOpen(false)}
                />
                <motion.div
                  ref={panelRef}
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                  style={panelStyle}
                  className="rounded-xl border border-[var(--border-color)]
                             bg-[var(--bg-card-solid)] shadow-xl overflow-hidden"
                  onTouchMove={(e) => e.stopPropagation()}
                >
                  {/* Header: month/year navigation */}
                  <div className="flex items-center justify-between px-3 pt-3 pb-2">
                    <button
                      type="button"
                      onClick={() => navigateMonth(-1)}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors
                                 text-[var(--text-secondary)] cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowYearPicker(!showYearPicker)}
                      className="text-sm font-semibold text-[var(--text-primary)]
                                 hover:bg-[var(--bg-hover)] px-3 py-1 rounded-lg
                                 transition-colors cursor-pointer"
                    >
                      {MONTHS[viewMonth]} {viewYear}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateMonth(1)}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors
                                 text-[var(--text-secondary)] cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {showYearPicker ? (
                      <motion.div
                        key="year-picker"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="px-3 pb-3"
                      >
                        <div className="grid grid-cols-4 gap-1.5">
                          {yearRange.map((y) => {
                            const isSelected = y === viewYear;
                            const isCurrent = y === today.year;
                            return (
                              <button
                                key={y}
                                type="button"
                                onClick={() => selectYear(y)}
                                className={`
                                  py-2 text-sm rounded-lg transition-all duration-150 cursor-pointer
                                  ${
                                    isSelected
                                      ? 'bg-primary-500 text-white font-semibold shadow-sm'
                                      : isCurrent
                                        ? 'text-primary-500 font-medium hover:bg-[var(--bg-hover)]'
                                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                                  }
                                `}
                              >
                                {y}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="calendar"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="px-3 pb-3"
                      >
                        {/* Days of week header */}
                        <div className="grid grid-cols-7 mb-1">
                          {DAYS.map((day, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-center h-8 text-xs
                                         font-medium text-[var(--text-muted)]"
                            >
                              {day}
                            </div>
                          ))}
                        </div>

                        {/* Calendar grid with slide animation */}
                        <div className="relative overflow-hidden" style={{ height: 240 }}>
                          <AnimatePresence initial={false} custom={direction} mode="popLayout">
                            <motion.div
                              key={`${viewYear}-${viewMonth}`}
                              custom={direction}
                              variants={slideVariants}
                              initial="enter"
                              animate="center"
                              exit="exit"
                              transition={{
                                x: { type: 'spring', stiffness: 350, damping: 32 },
                                opacity: { duration: 0.18 },
                              }}
                              className="grid grid-cols-7 gap-y-0.5"
                            >
                              {calendarDays.map((cell, i) => {
                                const isCurrentMonth = cell.currentMonth;
                                const isToday =
                                  isCurrentMonth &&
                                  cell.day === today.day &&
                                  viewMonth === today.month &&
                                  viewYear === today.year;
                                const isSelected =
                                  isCurrentMonth &&
                                  parsedValue !== null &&
                                  cell.day === parsedValue.day &&
                                  viewMonth === parsedValue.month &&
                                  viewYear === parsedValue.year;

                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => {
                                      if (isCurrentMonth) selectDate(cell.day);
                                    }}
                                    disabled={!isCurrentMonth}
                                    className={`
                                      flex items-center justify-center h-8 w-full text-sm
                                      rounded-lg transition-all duration-150
                                      ${
                                        isSelected
                                          ? 'bg-primary-500 text-white font-semibold shadow-sm'
                                          : isToday
                                            ? 'ring-1.5 ring-primary-400 text-primary-500 font-medium'
                                            : isCurrentMonth
                                              ? 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer'
                                              : 'text-[var(--text-muted)] opacity-30 cursor-default'
                                      }
                                      ${isCurrentMonth ? 'cursor-pointer' : ''}
                                    `}
                                  >
                                    {cell.day}
                                  </button>
                                );
                              })}
                            </motion.div>
                          </AnimatePresence>
                        </div>

                        {/* Today shortcut */}
                        <div className="mt-1.5 pt-2 border-t border-[var(--border-subtle)] flex justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              onChange(toDateString(today.year, today.month, today.day));
                              setOpen(false);
                            }}
                            className="text-xs font-medium text-primary-500 hover:text-primary-600
                                       px-3 py-1.5 rounded-lg hover:bg-primary-500/10
                                       transition-colors cursor-pointer"
                          >
                            Today
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
      </div>
    </div>
  );
}
