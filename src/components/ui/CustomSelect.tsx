import { useId } from 'react';
interface SelectOption { value:string;label:string; }
interface SelectProps { value:string;onChange:(value:string)=>void;options:SelectOption[];placeholder?:string;className?:string;label?:string; }
/** Native select preserves keyboard navigation, touch pickers, and screen reader semantics. */
export default function CustomSelect({value,onChange,options,placeholder='Select…',className='',label}:SelectProps) {
  const id=useId();
  return <div className={`relative ${className}`}><select id={id} value={value} onChange={e=>onChange(e.target.value)} aria-label={label||placeholder} className="w-full min-h-11 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] px-3 py-2">{!options.some(option=>option.value==='') && !options.some(option=>option.value===value) && <option value="" disabled>{placeholder}</option>}{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}
