import { useId } from 'react';
interface DropdownProps { label: string; value: string; options: readonly string[] | string[]; onChange: (value: string) => void; placeholder?: string; required?: boolean; id?: string; }
export default function Dropdown({ label, value, options, onChange, placeholder = 'Select...', required = false, id }: DropdownProps) {
 const generatedId = useId(); const controlId = id || generatedId;
 return <div className="space-y-1.5"><label htmlFor={controlId} className="block text-sm font-medium text-[var(--text-secondary)]">{label}{required && <span className="text-danger-500 ml-0.5">*</span>}</label>
 <select id={controlId} aria-required={required} value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-xl px-4 py-3 text-sm bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] cursor-pointer">
 <option value="">{placeholder}</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></div>;
}
