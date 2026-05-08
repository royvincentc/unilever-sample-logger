import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, ArrowLeft } from 'lucide-react';
import { DatePicker, TimePicker } from '../ui/TextInput';
import Dropdown from '../ui/Dropdown';
import MultiSelectGroup from '../ui/MultiSelectGroup';
import CollapsibleGroup from '../ui/CollapsibleGroup';
import Button from '../ui/Button';
import { ENVI_CATEGORIES, getEquipmentForCategories } from '../../data/sampleData';
import { PERSONNEL } from '../../data/personnelData';
import { STATUS_OPTIONS } from '../../data/constants';
import type { EnviCategory, EnviFormData, EnviEquipmentGroup } from '../../types';

interface EnviFormProps {
  onSubmit: (data: EnviFormData) => Promise<void>;
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

export default function EnviForm({ onSubmit, onBack }: EnviFormProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<EnviFormData>({
    dateSampled: new Date().toISOString().split('T')[0],
    timeSampled: '',
    categories: [],
    selectedSamples: [],
    swabbedBy: '',
    dateAnalyzed: '',
    analyzedBy: '',
    status: 'ONGOING',
  });

  const equipmentGroups: EnviEquipmentGroup[] = form.categories.length > 0
    ? getEquipmentForCategories(form.categories)
    : [];

  const handleToggleSample = useCallback((sample: string) => {
    setForm((prev) => ({
      ...prev,
      selectedSamples: prev.selectedSamples.includes(sample)
        ? prev.selectedSamples.filter((s) => s !== sample)
        : [...prev.selectedSamples, sample],
    }));
  }, []);

  const handleToggleAll = useCallback((samples: string[], selected: boolean) => {
    setForm((prev) => {
      const current = new Set(prev.selectedSamples);
      if (selected) {
        samples.forEach((s) => current.add(s));
      } else {
        samples.forEach((s) => current.delete(s));
      }
      return { ...prev, selectedSamples: Array.from(current) };
    });
  }, []);

  const allAvailableSamples = equipmentGroups.flatMap(g => g.samples);
  const allSamplesSelected = allAvailableSamples.length > 0 && 
    allAvailableSamples.every(s => form.selectedSamples.includes(s));

  const handleGlobalToggleAll = useCallback(() => {
    if (allSamplesSelected) {
      setForm(prev => ({ ...prev, selectedSamples: [] }));
    } else {
      setForm(prev => ({ ...prev, selectedSamples: [...allAvailableSamples] }));
    }
  }, [allSamplesSelected, allAvailableSamples]);

  const handleCategoriesChange = (cats: string[]) => {
    setForm((prev) => ({
      ...prev,
      categories: cats as EnviCategory[],
      selectedSamples: [], // Reset selected samples when categories change to prevent invalid state
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.selectedSamples.length === 0) return;
    setLoading(true);
    try {
      await onSubmit(form);
    } finally {
      setLoading(false);
    }
  };

  const isValid = form.dateSampled && form.timeSampled && form.categories.length > 0 && form.selectedSamples.length > 0 && form.swabbedBy;

  return (
    <form onSubmit={handleSubmit}>
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
        {/* Back button */}
        <motion.div variants={fadeUp}>
          <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Back to sample type
          </button>
        </motion.div>

        {/* Header */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
              <span className="text-lg font-bold text-white">E</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">ENVI Sample</h3>
              <p className="text-sm text-[var(--text-secondary)]">Environmental swab logging</p>
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

        {/* Category */}
        <motion.div variants={fadeUp} className="glass rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Categories</h4>
          <MultiSelectGroup
            label="Select categories"
            values={form.categories}
            options={ENVI_CATEGORIES.map((c) => c.label)}
            onChange={handleCategoriesChange}
            required
          />
        </motion.div>

        {/* Equipment & Samples */}
        {equipmentGroups.length > 0 && (
          <motion.div variants={fadeUp} className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                Samples
              </h4>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleGlobalToggleAll}
                  className="text-xs font-semibold text-primary-500 hover:text-primary-400 transition-colors cursor-pointer"
                >
                  {allSamplesSelected ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-xs text-[var(--text-secondary)] font-medium bg-[var(--bg-input)] px-2 py-1 rounded-md border border-[var(--border-color)]">
                  {form.selectedSamples.length} selected
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {equipmentGroups.map((group) => (
                <CollapsibleGroup
                  key={group.id}
                  id={group.id}
                  label={group.label}
                  samples={group.samples}
                  selectedSamples={form.selectedSamples}
                  onToggleSample={handleToggleSample}
                  onToggleAll={handleToggleAll}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Personnel & Status */}
        <motion.div variants={fadeUp} className="glass rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Dropdown label="Swabbed By" value={form.swabbedBy} options={PERSONNEL} onChange={(v) => setForm({ ...form, swabbedBy: v })} required />
            <DatePicker label="Date Analyzed" value={form.dateAnalyzed} onChange={(v) => setForm({ ...form, dateAnalyzed: v })} />
            <Dropdown label="Analyzed By" value={form.analyzedBy} options={PERSONNEL} onChange={(v) => setForm({ ...form, analyzedBy: v })} />
            <Dropdown label="Status" value={form.status} options={STATUS_OPTIONS} onChange={(v) => setForm({ ...form, status: v as any })} required />
          </div>
        </motion.div>

        {/* Submit */}
        <motion.div variants={fadeUp}>
          <Button
            type="submit"
            size="lg"
            loading={loading}
            disabled={!isValid}
            icon={<Send className="w-4 h-4" />}
            className="w-full"
          >
            Submit {form.selectedSamples.length > 0 ? `(${form.selectedSamples.length} samples)` : ''}
          </Button>
        </motion.div>
      </motion.div>
    </form>
  );
}
