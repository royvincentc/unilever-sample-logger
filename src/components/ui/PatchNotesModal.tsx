import React, { useState, useEffect, useRef } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import ScienceGraphic from './ScienceGraphic';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, CheckCircle2, Rocket } from 'lucide-react';

const CURRENT_PATCH_VERSION = "v1.2.0"; // Update this to show modal to users again

const PATCH_NOTES = {
  version: "v1.2.0",
  date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  title: "Your precision lab workspace",
  description: "A clearer workspace for sample logging, laboratory records, and connected workflows.",
  image: "/assets/images/patch_notes.jpg",
  highlights: [
    "Consistent light, dark, and system themes across all screens.",
    "Visible connection and offline queue status.",
    "Scientific illustrations and reduced-motion alternatives."
  ],
  fixes: [
    "Clearer sample identifiers and labels on narrow screens.",
    "Keyboard focus and accessible names for shared controls."
  ]
};

export default function PatchNotesModal() {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, isOpen, () => { setIsOpen(false); localStorage.setItem('seen_patch_version', CURRENT_PATCH_VERSION); });

  useEffect(() => {
    // Check if the user has already seen this specific patch version
    const seenVersion = localStorage.getItem('seen_patch_version');
    
    if (seenVersion !== CURRENT_PATCH_VERSION) {
      // Small delay for dramatic effect after dashboard load
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    localStorage.setItem('seen_patch_version', CURRENT_PATCH_VERSION);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
          onClick={handleDismiss}
        />

        {/* Modal */}
        <motion.div
          ref={dialogRef} role="dialog" aria-modal="true" aria-label="Workspace update"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-2xl bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-3xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]"
        >
          {/* Header Image */}
          <div className="relative h-48 sm:h-64 w-full bg-black overflow-hidden">
            <ScienceGraphic kind="molecule" animated className="w-full h-full text-teal-300" />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-app)] to-transparent" />
            
            <button 
              onClick={handleDismiss}
              aria-label="Close workspace update"
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-md transition-all z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="absolute bottom-4 left-6 right-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-primary-500/90 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5 shadow-lg">
                  <Sparkles className="w-3.5 h-3.5" />
                  New Update
                </span>
                <span className="text-white/80 text-sm font-mono">{PATCH_NOTES.version}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight drop-shadow-md">
                {PATCH_NOTES.title}
              </h2>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            <p className="text-[var(--text-secondary)] text-sm sm:text-base leading-relaxed mb-8">
              {PATCH_NOTES.description}
            </p>

            <div className="space-y-8">
              {/* Highlights */}
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2 mb-4">
                  <Rocket className="w-5 h-5 text-cyan-500" />
                  What's New
                </h3>
                <ul className="space-y-3">
                  {PATCH_NOTES.highlights.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                      <CheckCircle2 className="w-4.5 h-4.5 text-primary-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Fixes */}
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-emerald-500" />
                  Improvements & Fixes
                </h3>
                <ul className="space-y-3">
                  {PATCH_NOTES.fixes.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-2" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 bg-[var(--bg-hover)] border-t border-[var(--border-subtle)] flex items-center justify-between mt-auto">
            <span className="text-xs font-mono text-[var(--text-muted)]">
              Released on {PATCH_NOTES.date}
            </span>
            <button 
              onClick={handleDismiss}
              className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary-500/20 active:scale-95"
            >
              Got it, thanks!
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
