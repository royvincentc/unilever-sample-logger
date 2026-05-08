import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Minus } from 'lucide-react';

interface CollapsibleGroupProps {
  id: string;
  label: string;
  samples: string[];
  selectedSamples: string[];
  onToggleSample: (sample: string) => void;
  onToggleAll: (samples: string[], selected: boolean) => void;
}

export default function CollapsibleGroup({
  id,
  label,
  samples,
  selectedSamples,
  onToggleSample,
  onToggleAll,
}: CollapsibleGroupProps) {
  const [expanded, setExpanded] = useState(false);

  const selectedCount = samples.filter((s) => selectedSamples.includes(s)).length;
  const allSelected = selectedCount === samples.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const handleHeaderToggle = () => {
    if (allSelected) {
      onToggleAll(samples, false);
    } else {
      onToggleAll(samples, true);
    }
  };

  return (
    <motion.div
      layout
      className="rounded-xl border border-[var(--border-color)] overflow-hidden
                 bg-[var(--bg-card-solid)] transition-colors duration-200"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox */}
        <button
          type="button"
          onClick={handleHeaderToggle}
          className={`
            w-5 h-5 rounded-md border-2 flex items-center justify-center
            transition-all duration-200 flex-shrink-0 cursor-pointer
            ${
              allSelected
                ? 'bg-primary-500 border-primary-500'
                : someSelected
                ? 'bg-primary-500/30 border-primary-500'
                : 'border-[var(--border-color)] hover:border-primary-400'
            }
          `}
        >
          {allSelected && <Check className="w-3 h-3 text-white" />}
          {someSelected && <Minus className="w-3 h-3 text-white" />}
        </button>

        {/* Label + count */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center justify-between cursor-pointer"
        >
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {label}
            {selectedCount > 0 && (
              <span className="ml-2 text-xs font-normal text-primary-500">
                {selectedCount}/{samples.length}
              </span>
            )}
          </span>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          </motion.span>
        </button>
      </div>

      {/* Samples list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-0.5">
              {samples.map((sample) => {
                const isSelected = selectedSamples.includes(sample);
                return (
                  <button
                    key={`${id}-${sample}`}
                    type="button"
                    onClick={() => onToggleSample(sample)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg
                      text-sm text-left transition-all duration-150 cursor-pointer
                      ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-[var(--bg-hover)]'}
                    `}
                  >
                    <span
                      className={`
                        w-4 h-4 rounded border-2 flex items-center justify-center
                        transition-all duration-200 flex-shrink-0
                        ${
                          isSelected
                            ? 'bg-primary-500 border-primary-500'
                            : 'border-[var(--border-color)]'
                        }
                      `}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    <span className={isSelected ? 'text-primary-600 font-medium' : 'text-[var(--text-primary)]'}>
                      {sample}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
