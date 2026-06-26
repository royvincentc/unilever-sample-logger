import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, ArrowLeft } from 'lucide-react';
import { DatePicker, TimePicker } from '../ui/TextInput';
import Dropdown from '../ui/Dropdown';
import ComboBox from '../ui/ComboBox';
import Button from '../ui/Button';
import { PERSONNEL } from '../../data/personnelData';
import { getWaterSamplers } from '../../hooks/usePersonnel';
import { STATUS_OPTIONS, WATER_SOURCES } from '../../data/constants';
import type { WaterFormData, WaterSource } from '../../types';

interface WaterFormProps {
  onSubmit: (data: WaterFormData) => Promise<void>;
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

export default function WaterForm({ onSubmit, onBack }: WaterFormProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<WaterFormData>({
    dateSampled: new Date().toISOString().split('T')[0],
    timeSampled: '',
    waterSource: '',
    sampledBy: '',
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

  const isValid = form.dateSampled && form.timeSampled && form.waterSource && form.sampledBy;

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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
              <span className="text-lg font-bold text-white">W</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">WATER Sample</h3>
              <p className="text-sm text-[var(--text-secondary)]">Water source logging</p>
            </div>
          </div>
        </motion.div>

        {/* Date & Time */}
        <motion.div variants={fadeUp} className="glass rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Collection Info</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DatePicker label="Date Sampled" value={form.dateSampled} onChange={(v) => setForm({ ...form, dateSampled: v })} required />
            <TimePicker label="Time Sampled" value={form.timeSampled} onChange={(v) => setForm({ ...form, timeSampled: v })} required />
          </div>
        </motion.div>

        {/* Water Source */}
        <motion.div variants={fadeUp} className="glass rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Sample Info</h4>
          <Dropdown
            label="Water Source"
            value={form.waterSource}
            options={WATER_SOURCES}
            onChange={(v) => setForm({ ...form, waterSource: v as WaterSource })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">QTY</label>
              <div className="px-4 py-3 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] font-medium">1</div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Unit</label>
              <div className="px-4 py-3 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] font-medium">120 mL</div>
            </div>
          </div>
        </motion.div>

        {/* Personnel & Status */}
        <motion.div variants={fadeUp} className="glass rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ComboBox
              label="Sampled By"
              value={form.sampledBy}
              options={getWaterSamplers()}
              onChange={(v) => setForm({ ...form, sampledBy: v })}
              customPlaceholder="Type sampler name..."
              required
            />
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
            Submit Water Sample
          </Button>
        </motion.div>
      </motion.div>
    </form>
  );
}
