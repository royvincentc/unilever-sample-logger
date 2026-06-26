import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ChevronUp, ChevronDown, RotateCcw, Users } from 'lucide-react';
import { usePersonnel, type PersonnelListKey } from '../../hooks/usePersonnel';

interface ListEditorProps {
  title: string;
  subtitle: string;
  listKey: PersonnelListKey;
  allowMixedCase?: boolean;
}

function ListEditor({ title, subtitle, listKey, allowMixedCase = false }: ListEditorProps) {
  const { lists, addName, addNameRaw, removeName, moveUp, moveDown, resetToDefault } = usePersonnel();
  const [input, setInput] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const items = lists[listKey];

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (allowMixedCase) {
      addNameRaw(listKey, trimmed);
    } else {
      addName(listKey, trimmed);
    }
    setInput('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">{title}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>
        </div>
        {confirmReset ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-amber-400">Reset to defaults?</span>
            <button
              type="button"
              onClick={() => { resetToDefault(listKey); setConfirmReset(false); }}
              className="text-[11px] font-bold text-danger-500 hover:text-danger-400 transition-colors cursor-pointer"
            >Yes</button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >No</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-amber-400 transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* Name list */}
      <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
        <AnimatePresence initial={false}>
          {items.map((name, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] group transition-colors"
            >
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => moveUp(listKey, i)}
                  disabled={i === 0}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20 transition-colors cursor-pointer"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(listKey, i)}
                  disabled={i === items.length - 1}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20 transition-colors cursor-pointer"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              {/* Name */}
              <span className="flex-1 text-sm text-[var(--text-primary)] font-medium">{name}</span>

              {/* Index badge */}
              <span className="text-[10px] text-[var(--text-muted)] font-mono w-5 text-right">{i + 1}</span>

              {/* Delete */}
              <button
                type="button"
                onClick={() => removeName(listKey, name)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-danger-500 hover:bg-danger-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">
            No names yet — add one below
          </div>
        )}
      </div>

      {/* Add new name */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={allowMixedCase ? 'e.g. PF4: J. Santos' : 'e.g. SANTOS'}
          className="
            flex-1 px-3 py-2 rounded-xl text-sm
            bg-[var(--bg-input)] border border-[var(--border-color)]
            text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
            focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500
            transition-all duration-200
          "
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim()}
          className="
            flex items-center gap-1.5 px-4 py-2 rounded-xl
            bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold
            disabled:opacity-40 transition-all cursor-pointer shadow-sm shadow-primary-500/20
          "
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
    </div>
  );
}

export default function PersonnelEditor() {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="glass rounded-2xl overflow-hidden"
    >
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary-500" />
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">
            Personnel Lists
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Manage dropdown names</span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          </motion.span>
        </div>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-6 space-y-8 border-t border-[var(--border-subtle)]">
              <div className="pt-5">
                <ListEditor
                  listKey="waterSampler"
                  title="Water — Sampled By"
                  subtitle='Names shown in the "Sampled By" dropdown on the Water form. Supports mixed case (e.g. PF4: J. Santos).'
                  allowMixedCase
                />
              </div>

              <div className="border-t border-[var(--border-subtle)] pt-6">
                <ListEditor
                  listKey="envi"
                  title="ENVI / RawMats — Personnel"
                  subtitle='Names shown in "Swabbed By", "Analyzed By", and "Received By" dropdowns. Auto-uppercased.'
                />
              </div>

              <div className="border-t border-[var(--border-subtle)] pt-6">
                <ListEditor
                  listKey="waterAnalyst"
                  title="Water — Analyzed By"
                  subtitle='Names shown in the "Analyzed By" dropdown on the Water form. Auto-uppercased.'
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
