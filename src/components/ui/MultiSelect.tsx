import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  className?: string;
}

export default function MultiSelect({ values, onChange, options, placeholder = "Select...", className = "" }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getLabel = () => {
    if (values.length === 0) return placeholder;
    if (values.includes('All')) return 'All Analysts';
    if (values.length === 1) return options.find(o => o.value === values[0])?.label || placeholder;
    return `${values.length} Selected`;
  };

  const handleToggle = (val: string) => {
    if (val === 'All') {
       onChange(['All']);
       return;
    }

    let newValues = [...values].filter(v => v !== 'All'); // if they click a specific one, remove 'All'
    if (newValues.includes(val)) {
      newValues = newValues.filter(v => v !== val);
    } else {
      newValues.push(val);
    }
    
    if (newValues.length === 0) {
       newValues = ['All']; // default fallback
    }
    onChange(newValues);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm group hover:border-primary-500/30"
      >
        <span className="truncate mr-4 font-semibold">
          {getLabel()}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 group-hover:text-primary-500 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 w-full min-w-max mt-1.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl shadow-2xl backdrop-blur-2xl max-h-60 overflow-y-auto hide-scrollbar"
            style={{ transformOrigin: "top" }}
          >
            <div className="p-1.5 flex flex-col gap-0.5">
              {options.map((option) => {
                const isSelected = values.includes(option.value) || (option.value === 'All' && values.length === 0);
                return (
                  <button
                    key={option.value}
                    onClick={() => handleToggle(option.value)}
                    className={`flex items-center justify-between w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-150
                      ${isSelected 
                        ? 'bg-primary-500/15 text-primary-500 font-bold' 
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] font-medium'
                      }`}
                  >
                    <span className="truncate pr-4">{option.label}</span>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary-500 border-primary-500' : 'border-[var(--border-subtle)]'}`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
