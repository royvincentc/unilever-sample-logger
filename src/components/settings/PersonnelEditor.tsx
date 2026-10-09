import { useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { usePersonnel, type PersonnelListKey } from '../../hooks/usePersonnel';
import PersonnelSync from '../ui/PersonnelSync';

const labels: Record<PersonnelListKey, string> = {
  envi: 'ENVI — Swabbed By', enviAnalyst: 'ENVI — Analyzed By',
  waterSampler: 'WATER — Sampled By', waterAnalyst: 'WATER — Analyzed By',
  air: 'AIR — Performed By', rawReceiver: 'SFG / FG / RM — Received By', rawAnalyst: 'SFG / FG / RM — Analyzed By',
};

export default function PersonnelEditor() {
  const [open, setOpen] = useState(false);
  const { lists } = usePersonnel();
  return <div className="glass rounded-2xl overflow-hidden">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="personnel-lists" className="w-full flex items-center justify-between p-5 cursor-pointer">
      <span className="flex items-center gap-2"><Users size={16} />Personnel Lists</span><ChevronDown size={16} />
    </button>
    <div className="px-5 pb-5"><PersonnelSync /></div>
    {open && <div id="personnel-lists" className="px-5 pb-5 space-y-5">
      <p className="text-sm text-[var(--text-secondary)]">Edit names in the Google Sheets dropdowns, then sync here.</p>
      {(Object.keys(labels) as PersonnelListKey[]).map(key => <div key={key}>
        <h4 className="text-sm font-semibold mb-2">{labels[key]}</h4>
        <p className="text-sm text-[var(--text-secondary)]">{lists[key].join(', ')}</p>
      </div>)}
    </div>}
  </div>;
}
