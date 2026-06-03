import CustomDatePicker from './DatePicker';
import CustomTimePicker from './TimePicker';

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'email' | 'password';
  id?: string;
}

export default function TextInput({
  label,
  value,
  onChange,
  placeholder = '',
  required = false,
  type = 'text',
  id,
}: TextInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-[var(--text-secondary)]">
        {label}
        {required && <span className="text-danger-500 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full"
      />
    </div>
  );
}

// ===== DATE PICKER =====
export function DatePicker({
  label,
  value,
  onChange,
  required = false,
  id,
}: Omit<TextInputProps, 'type' | 'placeholder'>) {
  return (
    <CustomDatePicker
      label={label}
      value={value}
      onChange={onChange}
      required={required}
      id={id}
    />
  );
}

// ===== TIME PICKER =====
export function TimePicker({
  label,
  value,
  onChange,
  required = false,
  id,
}: Omit<TextInputProps, 'type' | 'placeholder'>) {
  return (
    <CustomTimePicker
      label={label}
      value={value}
      onChange={onChange}
      required={required}
      id={id}
    />
  );
}
