import { motion } from 'framer-motion';
import { Droplets, FlaskConical, Package, Wind } from 'lucide-react';
import type { SampleType } from '../../types';

interface SampleTypeSelectorProps {
  onSelect: (type: SampleType) => void;
}

const types = [
  {
    id: 'ENVI' as SampleType,
    label: 'ENVI',
    description: 'Environmental swab samples',
    icon: FlaskConical,
    gradient: 'from-emerald-500 to-teal-500',
    shadow: 'shadow-emerald-500/25',
  },
  {
    id: 'WATER' as SampleType,
    label: 'WATER',
    description: 'Water source samples',
    icon: Droplets,
    gradient: 'from-blue-500 to-cyan-500',
    shadow: 'shadow-blue-500/25',
  },
  {
    id: 'RawMats' as SampleType,
    label: 'RawMats, FG & SFG',
    description: 'Raw materials & finished goods',
    icon: Package,
    gradient: 'from-violet-500 to-purple-500',
    shadow: 'shadow-violet-500/25',
  },
  {
    id: 'AIR' as SampleType,
    label: 'AIR',
    description: 'Air quality samples',
    icon: Wind,
    gradient: 'from-yellow-400 to-amber-500',
    shadow: 'shadow-amber-500/25',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function SampleTypeSelector({ onSelect }: SampleTypeSelectorProps) {
  return (
    <div className="px-4 lg:px-8 py-6">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">What type of sample?</h3>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Select the sample type to begin logging
        </p>
      </div>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {types.map((type) => (
          <motion.button
            key={type.id}
            variants={item}
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(type.id)}
            className="glass rounded-2xl p-6 text-left cursor-pointer
                       group transition-all duration-300
                       hover:shadow-xl"
          >
            <div
              className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${type.gradient}
                          flex items-center justify-center mb-4
                          shadow-lg ${type.shadow}
                          group-hover:scale-110 transition-transform duration-300`}
            >
              <type.icon className="w-7 h-7 text-white" />
            </div>
            <h4 className="text-base font-bold text-[var(--text-primary)] mb-1">
              {type.label}
            </h4>
            <p className="text-sm text-[var(--text-secondary)]">{type.description}</p>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
