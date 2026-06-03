import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';

interface TimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  id?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const PERIODS = ['AM', 'PM'] as const;

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const COLUMN_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const SCROLL_PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

function formatMinute(m: number): string {
  return m.toString().padStart(2, '0');
}

function to12Hour(value: string): { hour: number; minute: number; period: 'AM' | 'PM' } {
  if (!value) return { hour: 12, minute: 0, period: 'AM' };
  const [hStr, mStr] = value.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const roundedMinute = Math.round(m / 5) * 5 >= 60 ? 55 : Math.round(m / 5) * 5;
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { hour: h, minute: roundedMinute, period };
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

// --- ScrollColumn ---
interface ScrollColumnProps {
  items: (string | number)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  formatItem?: (item: string | number) => string;
}

function ScrollColumn({ items, selectedIndex, onSelect, formatItem }: ScrollColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<any>(null);
  const isMountedScrollRef = useRef(false);

  const scrollToIndex = useCallback(
    (index: number, smooth: boolean) => {
      const el = containerRef.current;
      if (!el) return;
      const targetScroll = index * ITEM_HEIGHT;
      isScrollingRef.current = true;
      el.scrollTo({ top: targetScroll, behavior: smooth ? 'smooth' : 'instant' });
      // Release the programmatic scroll lock after animation settles
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, smooth ? 350 : 50);
    },
    [],
  );

  // On mount + when selectedIndex changes from parent, scroll to it
  useEffect(() => {
    const smooth = isMountedScrollRef.current;
    isMountedScrollRef.current = true;
    scrollToIndex(selectedIndex, smooth);
  }, [selectedIndex, scrollToIndex]);

  // Detect scroll-end and snap to nearest item
  const handleScroll = useCallback(() => {
    if (isScrollingRef.current) return;
    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const index = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      if (clamped !== selectedIndex) {
        onSelect(clamped);
      }
      // Snap precisely
      scrollToIndex(clamped, true);
    }, 80);
  }, [items.length, selectedIndex, onSelect, scrollToIndex]);

  // Cleanup
  useEffect(() => {
    return () => clearTimeout(scrollTimeoutRef.current);
  }, []);

  return (
    <div
      className="relative flex-1"
      style={{ height: COLUMN_HEIGHT }}
    >
      {/* Fade mask */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          maskImage: `linear-gradient(to bottom, transparent 0%, black ${ITEM_HEIGHT}px, black ${COLUMN_HEIGHT - ITEM_HEIGHT}px, transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to bottom, transparent 0%, black ${ITEM_HEIGHT}px, black ${COLUMN_HEIGHT - ITEM_HEIGHT}px, transparent 100%)`,
        }}
      />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto no-scrollbar"
        style={{
          scrollSnapType: 'y mandatory',
          maskImage: `linear-gradient(to bottom, transparent 0%, black ${ITEM_HEIGHT}px, black ${COLUMN_HEIGHT - ITEM_HEIGHT}px, transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to bottom, transparent 0%, black ${ITEM_HEIGHT}px, black ${COLUMN_HEIGHT - ITEM_HEIGHT}px, transparent 100%)`,
        }}
      >
        {/* Top padding */}
        <div style={{ height: SCROLL_PADDING }} />

        {items.map((item, i) => {
          const isSelected = i === selectedIndex;
          const display = formatItem ? formatItem(item) : String(item);
          return (
            <div
              key={i}
              className="flex items-center justify-center cursor-pointer select-none transition-all duration-200"
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: 'center',
                fontSize: isSelected ? 20 : 16,
                fontWeight: isSelected ? 600 : 400,
                color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                opacity: isSelected ? 1 : 0.5,
                transform: isSelected ? 'scale(1.08)' : 'scale(0.95)',
              }}
              onClick={() => {
                onSelect(i);
                scrollToIndex(i, true);
              }}
            >
              {display}
            </div>
          );
        })}

        {/* Bottom padding */}
        <div style={{ height: SCROLL_PADDING }} />
      </div>
    </div>
  );
}

// --- TimePicker ---
export default function TimePicker({
  label,
  value,
  onChange,
  required = false,
  id,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);

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
    setOpen(true);
  };

  const handleConfirm = () => {
    onChange(to24Hour(tempHour, tempMinute, tempPeriod));
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const hourIndex = HOURS.indexOf(tempHour);
  const minuteIndex = MINUTES.indexOf(tempMinute);
  const periodIndex = PERIODS.indexOf(tempPeriod);

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
                relative z-10 w-full max-w-[340px]
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
              <div className="px-6 pt-5 pb-2 text-center">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  Select Time
                </h3>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">
                  {tempHour}:{formatMinute(tempMinute)} {tempPeriod}
                </p>
              </div>

              {/* Drum picker area */}
              <div className="relative px-4 py-2">
                {/* Selection highlight band */}
                <div
                  className="
                    absolute left-4 right-4 rounded-xl
                    bg-[var(--bg-hover)] border border-[var(--border-subtle)]
                  "
                  style={{
                    height: ITEM_HEIGHT,
                    top: `calc(50% - ${ITEM_HEIGHT / 2}px)`,
                  }}
                />

                {/* Columns */}
                <div className="relative flex gap-1">
                  {/* Hour */}
                  <ScrollColumn
                    items={HOURS}
                    selectedIndex={hourIndex >= 0 ? hourIndex : 0}
                    onSelect={(i) => setTempHour(HOURS[i])}
                  />

                  {/* Separator */}
                  <div
                    className="flex items-center justify-center text-[var(--text-muted)] font-bold text-xl select-none"
                    style={{ width: 16, height: COLUMN_HEIGHT }}
                  >
                    :
                  </div>

                  {/* Minute */}
                  <ScrollColumn
                    items={MINUTES}
                    selectedIndex={minuteIndex >= 0 ? minuteIndex : 0}
                    onSelect={(i) => setTempMinute(MINUTES[i])}
                    formatItem={(m) => formatMinute(m as number)}
                  />

                  {/* Period */}
                  <ScrollColumn
                    items={PERIODS as unknown as string[]}
                    selectedIndex={periodIndex >= 0 ? periodIndex : 0}
                    onSelect={(i) => setTempPeriod(PERIODS[i])}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 px-6 pt-2 pb-5">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="
                    flex-1 py-2.5 rounded-xl text-sm font-medium
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
                    flex-1 py-2.5 rounded-xl text-sm font-medium
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

      {/* Hide native scrollbar utility */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
