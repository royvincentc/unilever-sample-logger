import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus, Minus } from 'lucide-react';

interface TimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  id?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES_PRESETS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function formatMinute(m: number): string {
  return m.toString().padStart(2, '0');
}

function to12Hour(value: string): { hour: number; minute: number; period: 'AM' | 'PM' } {
  if (!value) {
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes();
    const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return { hour: h, minute: m, period };
  }
  const [hStr, mStr] = value.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { hour: h, minute: m, period };
}

function to24Hour(hour: number, minute: number, period: 'AM' | 'PM'): string {
  let h = hour;
  if (period === 'AM' && h === 12) h = 0;
  else if (period === 'PM' && h !== 12) h += 12;
  return `${h.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function formatDisplayTime(value: string): string {
  if (!value) return '';
  const { hour, minute, period } = to12Hour(value);
  return `${hour}:${formatMinute(minute)} ${period}`;
}

export default function TimePicker({
  label,
  value,
  onChange,
  required = false,
  id,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [activeField, setActiveField] = useState<'hour' | 'minute'>('hour');

  // Temp selections while picker is open
  const parsed = to12Hour(value);
  const [tempHour, setTempHour] = useState(parsed.hour);
  const [tempMinute, setTempMinute] = useState(parsed.minute);
  const [tempPeriod, setTempPeriod] = useState<'AM' | 'PM'>(parsed.period);

  // Sync temp state when opening
  const handleOpen = () => {
    const p = to12Hour(value);
    setTempHour(p.hour);
    setTempMinute(p.minute);
    setTempPeriod(p.period);
    setActiveField('hour');
    setOpen(true);
  };

  const handleConfirm = useCallback(() => {
    onChange(to24Hour(tempHour, tempMinute, tempPeriod));
    setOpen(false);
  }, [tempHour, tempMinute, tempPeriod, onChange]);

  const handleCancel = useCallback(() => {
    setOpen(false);
  }, []);

  // Prevent body scroll when time picker is open
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

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key === 'ArrowLeft') {
        setActiveField('hour');
      } else if (e.key === 'ArrowRight') {
        setActiveField('minute');
      } else if (e.key.toLowerCase() === 'a') {
        setTempPeriod('AM');
      } else if (e.key.toLowerCase() === 'p') {
        setTempPeriod('PM');
      } else if (/^[0-9]$/.test(e.key)) {
        const num = parseInt(e.key, 10);
        if (activeField === 'hour') {
          setTempHour((prev) => {
            const next = prev >= 10 ? num : prev * 10 + num;
            return next >= 1 && next <= 12 ? next : num || 12;
          });
        } else {
          setTempMinute((prev) => {
            const next = (prev % 10) * 10 + num;
            return next >= 0 && next <= 59 ? next : num;
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, activeField, handleConfirm, handleCancel]);

  return (
    <div className="space-y-1.5">
      {/* Label */}
      <label className="block text-sm font-medium text-[var(--text-secondary)]">
        {label}
        {required && <span className="text-danger-500 ml-0.5">*</span>}
      </label>

      {/* Trigger button */}
      <button
        id={id}
        type="button"
        onClick={handleOpen}
        className="
          w-full flex items-center gap-3 text-left
          rounded-xl border border-[var(--border-color)]
          bg-[var(--bg-input)] px-4 py-3
          text-[15px] font-normal
          transition-all duration-200
          hover:border-primary-400
          focus:outline-none focus:border-primary-500
          focus:ring-[3px] focus:ring-primary-500/15
          cursor-pointer
        "
      >
        <Clock className="w-[18px] h-[18px] text-[var(--text-muted)] flex-shrink-0" />
        {value ? (
          <span className="text-[var(--text-primary)]">{formatDisplayTime(value)}</span>
        ) : (
          <span className="text-[var(--text-muted)]">Select time</span>
        )}
      </button>

      {/* Picker overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0"
              style={{
                backgroundColor: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
              onClick={handleCancel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Card */}
            <motion.div
              className="
                relative z-10 w-full max-w-[325px]
                rounded-2xl border border-[var(--border-color)]
                bg-[var(--bg-card-solid)]
                shadow-xl overflow-hidden
              "
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            >
              {/* Header */}
              <div className="px-5 pt-4 pb-2 text-center border-b border-[var(--border-subtle)]">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  Select Time
                </h3>
              </div>

              {/* Time Display Section */}
              <div className="flex items-center justify-center gap-3 my-4 px-4">
                {/* Hour Box */}
                <button
                  type="button"
                  onClick={() => setActiveField('hour')}
                  className={`
                    text-3xl font-bold px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer
                    ${activeField === 'hour' 
                      ? 'bg-primary-500/10 text-primary-500 ring-2 ring-primary-500' 
                      : 'bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-primary-400'
                    }
                  `}
                >
                  {tempHour.toString().padStart(2, '0')}
                </button>

                <span className="text-2xl font-bold text-[var(--text-muted)] animate-pulse">:</span>

                {/* Minute Box */}
                <button
                  type="button"
                  onClick={() => setActiveField('minute')}
                  className={`
                    text-3xl font-bold px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer
                    ${activeField === 'minute' 
                      ? 'bg-primary-500/10 text-primary-500 ring-2 ring-primary-500' 
                      : 'bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-primary-400'
                    }
                  `}
                >
                  {tempMinute.toString().padStart(2, '0')}
                </button>

                {/* AM/PM toggle button */}
                <div className="flex flex-col gap-1 ml-1.5">
                  <button
                    type="button"
                    onClick={() => setTempPeriod('AM')}
                    className={`
                      px-2.5 py-0.5 text-xs font-bold rounded transition-all duration-150 cursor-pointer
                      ${tempPeriod === 'AM' 
                        ? 'bg-primary-500 text-white shadow-sm' 
                        : 'bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border-color)] hover:text-[var(--text-primary)]'
                      }
                    `}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempPeriod('PM')}
                    className={`
                      px-2.5 py-0.5 text-xs font-bold rounded transition-all duration-150 cursor-pointer
                      ${tempPeriod === 'PM' 
                        ? 'bg-primary-500 text-white shadow-sm' 
                        : 'bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border-color)] hover:text-[var(--text-primary)]'
                      }
                    `}
                  >
                    PM
                  </button>
                </div>
              </div>

              {/* Selector view panel with animation */}
              <div className="px-5 pb-4 min-h-[200px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  {activeField === 'hour' ? (
                    <motion.div
                      key="hour-picker"
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 15 }}
                      transition={{ duration: 0.15 }}
                      className="grid grid-cols-4 gap-2 py-1"
                    >
                      {HOURS.map((h) => {
                        const isSelected = h === tempHour;
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => {
                              setTempHour(h);
                              setActiveField('minute');
                            }}
                            className={`
                              aspect-square flex items-center justify-center text-base font-semibold rounded-xl transition-all duration-150 cursor-pointer
                              ${isSelected 
                                ? 'bg-primary-500 text-white shadow-md scale-105' 
                                : 'bg-[var(--bg-input)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                              }
                            `}
                          >
                            {h}
                          </button>
                        );
                      })}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="minute-picker"
                      initial={{ opacity: 0, x: 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -15 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-4 py-1"
                    >
                      {/* Presets Grid */}
                      <div className="grid grid-cols-4 gap-2">
                        {MINUTES_PRESETS.map((m) => {
                          const isSelected = m === tempMinute;
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setTempMinute(m)}
                              className={`
                                py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer
                                ${isSelected 
                                  ? 'bg-primary-500 text-white shadow-sm scale-105' 
                                  : 'bg-[var(--bg-input)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                                }
                              `}
                            >
                              {m.toString().padStart(2, '0')}
                            </button>
                          );
                        })}
                      </div>

                      {/* Slider and Fine adjustment */}
                      <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[var(--text-muted)] font-medium">Fine Tune:</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setTempMinute((m) => (m === 0 ? 59 : m - 1))}
                              className="p-1 rounded bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-sm font-semibold text-primary-500 w-8 text-center">{tempMinute.toString().padStart(2, '0')}</span>
                            <button
                              type="button"
                              onClick={() => setTempMinute((m) => (m === 59 ? 0 : m + 1))}
                              className="p-1 rounded bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="px-1 flex items-center h-6">
                          <input
                            type="range"
                            min="0"
                            max="59"
                            value={tempMinute}
                            onChange={(e) => setTempMinute(parseInt(e.target.value, 10))}
                            className="w-full accent-primary-500 cursor-pointer"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 px-5 pb-5 border-t border-[var(--border-subtle)] pt-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="
                    flex-1 py-2 rounded-xl text-sm font-medium
                    text-[var(--text-secondary)]
                    hover:bg-[var(--bg-hover)]
                    transition-colors duration-200
                    cursor-pointer
                  "
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="
                    flex-1 py-2 rounded-xl text-sm font-medium
                    bg-primary-500 hover:bg-primary-600
                    text-white shadow-md hover:shadow-lg
                    transition-all duration-200
                    cursor-pointer
                  "
                >
                  Set
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
