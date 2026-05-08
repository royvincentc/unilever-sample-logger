import { motion } from 'framer-motion';

interface MultiSelectGroupProps {
  label: string;
  values: string[];
  options: readonly string[] | string[];
  onChange: (values: string[]) => void;
  required?: boolean;
}

export default function MultiSelectGroup({
  label,
  values,
  options,
  onChange,
  required = false,
}: MultiSelectGroupProps) {
  const toggle = (opt: string) => {
    if (values.includes(opt)) {
      onChange(values.filter(v => v !== opt));
    } else {
      onChange([...values, opt]);
    }
  };

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
            onClick={() => toggle(opt)}
            className={`
              px-4 py-2.5 rounded-xl text-sm font-medium
              transition-all duration-200 border cursor-pointer
              ${
                values.includes(opt)
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
