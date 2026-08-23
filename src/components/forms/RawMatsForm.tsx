import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, ArrowLeft } from 'lucide-react';
import TextInput, { DatePicker, TimePicker } from '../ui/TextInput';
import Dropdown from '../ui/Dropdown';
import ComboBox from '../ui/ComboBox';
import RadioGroup from '../ui/RadioGroup';
import Button from '../ui/Button';
import { PERSONNEL, PERSONNEL_WITH_MARK } from '../../data/personnelData';
import {
  STATUS_OPTIONS,
  RAWMATS_TYPES,
  RFAF_OPTIONS,
  RAWMATS_SAMPLES,
  RAWMATS_SOURCES,
} from '../../data/constants';
import type { RawMatsFormData, RawMatsType, RfafOption } from '../../types';

interface RawMatsFormProps {
  onSubmit: (data: RawMatsFormData) => Promise<void>;
  onBack: () => void;
}

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function RawMatsForm({ onSubmit, onBack }: RawMatsFormProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<RawMatsFormData>({
    dateSampled: new Date().toISOString().split('T')[0],
    timeSampled: '',
    rfaf: '',
    mixingBatchNo: '',
    cucNo: '',
    type: '',
    sample: '',
    source: '',
    receivedBy: '',
    dateAnalyzed: '',
    analyzedBy: '',
    status: '',
    remarks: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(form);
    } finally {
      setLoading(false);
    }
  };

  const isValid = form.dateSampled && form.timeSampled && form.rfaf && form.type && form.sample && form.source;

  return (
    <form onSubmit={handleSubmit}>
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={fadeUp}>
          <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Back to sample type
          </button>
        </motion.div>

        <motion.div variants={fadeUp}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
              <span className="text-lg font-bold text-white">R</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">RawMats, FG & SFG</h3>
              <p className="text-sm text-[var(--text-secondary)]">Raw materials & finished goods</p>
            </div>
          </div>
        </motion.div>

        {/* Date & Time */}
        <motion.div variants={fadeUp} className="glass rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Collection Info</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DatePicker label="Date Received / Sampled" value={form.dateSampled} onChange={(v) => setForm({ ...form, dateSampled: v })} required />
            <TimePicker label="Time" value={form.timeSampled} onChange={(v) => setForm({ ...form, timeSampled: v })} required />
          </div>
        </motion.div>

        {/* RFAF, Batch, CUC */}
        <motion.div variants={fadeUp} className="glass rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Reference</h4>
          <RadioGroup label="RFAF" value={form.rfaf} options={RFAF_OPTIONS} onChange={(v) => setForm({ ...form, rfaf: v as RfafOption })} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput label="Mixing Batch #" value={form.mixingBatchNo} onChange={(v) => setForm({ ...form, mixingBatchNo: v })} placeholder="Optional" />
            <TextInput label="CUC #" value={form.cucNo} onChange={(v) => setForm({ ...form, cucNo: v })} placeholder="Optional" />
          </div>
        </motion.div>

        {/* Type, Sample, Source */}
        <motion.div variants={fadeUp} className="glass rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Sample Details</h4>
          <RadioGroup label="Type" value={form.type} options={RAWMATS_TYPES} onChange={(v) => setForm({ ...form, type: v as RawMatsType })} required />
          <ComboBox label="Sample" value={form.sample} options={RAWMATS_SAMPLES} onChange={(v) => setForm({ ...form, sample: v })} placeholder="Select sample..." required />
          <Dropdown label="Source" value={form.source} options={RAWMATS_SOURCES} onChange={(v) => setForm({ ...form, source: v })} placeholder="Select source..." required />
        </motion.div>

        {/* Personnel & Status */}
        <motion.div variants={fadeUp} className="glass rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Dropdown label="Received By" value={form.receivedBy} options={PERSONNEL_WITH_MARK} onChange={(v) => setForm({ ...form, receivedBy: v })} required />
            <Dropdown label="Endorsed To (Optional)" value={form.endorsedTo || 'None'} options={['None', ...PERSONNEL]} onChange={(v) => setForm({ ...form, endorsedTo: v === 'None' ? '' : v })} />
            <DatePicker label="Date Analyzed" value={form.dateAnalyzed} onChange={(v) => setForm({ ...form, dateAnalyzed: v })} />
            <Dropdown label="Analyzed By" value={form.analyzedBy} options={PERSONNEL} onChange={(v) => setForm({ ...form, analyzedBy: v })} />
            <Dropdown label="Status" value={form.status} options={STATUS_OPTIONS} onChange={(v) => setForm({ ...form, status: v as any })} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--text-secondary)]">Remarks</label>
            <textarea
              value={form.remarks || ''}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              placeholder="Optional remarks or notes..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]
                         text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                         focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                         transition-all duration-200 resize-none"
            />
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Button type="submit" size="lg" loading={loading} disabled={!isValid} icon={<Send className="w-4 h-4" />} className="w-full">
            Submit RawMats Sample
          </Button>
        </motion.div>
      </motion.div>
    </form>
  );
}
