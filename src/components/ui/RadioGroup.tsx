import { motion } from 'framer-motion';

interface RadioGroupProps {
  label: string;
  value: string;
  options: readonly string[] | string[];
  onChange: (value: string) => void;
  required?: boolean;
}

export default function RadioGroup({
  label,
  value,
  options,
  onChange,
  required = false,
}: RadioGroupProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--text-secondary)]">
        {label}
        {required && <span className="text-danger-500 ml-0.5">*</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {(options as string[]).map((opt) => (
          <motion.button
            key={opt}
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(opt)}
            className={`
              px-4 py-2.5 rounded-xl text-sm font-medium
              transition-all duration-200 border cursor-pointer
              ${
                value === opt
                  ? 'bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-500/25'
                  : 'bg-[var(--bg-input)] text-[var(--text-primary)] border-[var(--border-color)] hover:border-primary-400'
              }
            `}
          >
            {opt}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
