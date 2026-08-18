import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save } from 'lucide-react';
import type { AirFormData, AirMethod, AirSamplingPoint } from '../../types';
import DatePicker from '../ui/DatePicker';
import TimePicker from '../ui/TimePicker';
import Dropdown from '../ui/Dropdown';
import Button from '../ui/Button';
import { PERSONNEL } from '../../data/personnelData';
import { STATUS_OPTIONS } from '../../data/constants';

interface AirFormProps {
  onSubmit: (data: AirFormData) => Promise<void>;
  onBack: () => void;
}

const AIR_METHODS: AirMethod[] = ['ACTIVE', 'PASSIVE'];

const SAMPLING_POINTS: AirSamplingPoint[] = [
  'Compounding Area: Corner 1',
  'Compounding Area: Corner 2',
  'Compounding Area: Corner 3',
  'Compounding Area: Corner 4',
  'Compounding Area: Center',
  'Compounding Area: Main Mixing Tank Center',
  'Filling Area: Akash 1 - Near Nozzle',
  'Filling Area: Akash 1 - Near Packaging',
  'Filling Area: Akash 2 - Near Nozzle',
  'Filling Area: Akash 2 - Near Packaging',
  'Filling Area: Leepack - Near Nozzle',
  'Filling Area: Leepack - Near Packaging',
  'Dispensary Area: Center'
];

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function AirForm({ onSubmit, onBack }: AirFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<AirFormData>({
    method: '',
    samplingPoint: '',
    dateSampled: new Date().toISOString().split('T')[0],
    timeSampled: '',
    performedBy: '',
    status: 'ON GOING',
    remarks: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <motion.div
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to types</span>
          </button>
        </div>

        <motion.div variants={fadeUp} className="glass rounded-2xl p-5 space-y-4 border border-amber-500/20">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider text-amber-500">Method & Location</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Dropdown
              label="Method"
              value={form.method}
              options={AIR_METHODS}
              onChange={(v: string) => setForm({ ...form, method: v as AirMethod })}
              placeholder="Select method..."
              required
            />
            <Dropdown
              label="Sampling Point"
              value={form.samplingPoint}
              options={SAMPLING_POINTS}
              onChange={(v: string) => setForm({ ...form, samplingPoint: v as AirSamplingPoint })}
              placeholder="Select sampling point..."
              required
            />
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="glass rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Time & Place</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DatePicker label="Date Performed" value={form.dateSampled} onChange={(v: string) => setForm({ ...form, dateSampled: v })} required />
            <TimePicker label="Time" value={form.timeSampled} onChange={(v: string) => setForm({ ...form, timeSampled: v })} required />
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="glass rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Dropdown
              label="Performed By"
              value={form.performedBy}
              options={PERSONNEL}
              onChange={(v: string) => setForm({ ...form, performedBy: v })}
              required
            />
            <Dropdown
              label="Status"
              value={form.status}
              options={STATUS_OPTIONS}
              onChange={(v: string) => setForm({ ...form, status: v as any })}
            />
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

        <motion.div variants={fadeUp} className="pt-4">
          <Button
            type="submit"
            size="lg"
            className="w-full shadow-lg shadow-amber-500/20 bg-amber-500 text-white hover:bg-amber-600"
            loading={isSubmitting}
            icon={<Save className="w-5 h-5" />}
          >
            Submit Air Sample
          </Button>
        </motion.div>
      </motion.div>
    </form>
  );
}
