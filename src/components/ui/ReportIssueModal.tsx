import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from './Toast';
import { getUserName } from '../../utils/auth';
import { submitIssueReport, type IssueReport } from '../../utils/db';
import Button from './Button';

export default function ReportIssueModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [loading, setLoading] = useState(false);
  
  const location = useLocation();
  const { showToast } = useToast();
  const userName = getUserName();

  const handleOpen = () => {
    setIsOpen(true);
    // Reset form when opening
    setSubject('');
    setDescription('');
    setSeverity('medium');
  };

  const handleClose = () => {
    if (loading) return;
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      showToast('warning', 'Incomplete Form', 'Please fill in all required fields.');
      return;
    }

    const emailTo = 'vincecodinera@gmail.com';
    const emailSubject = `[Sample Logger Bug] ${subject.trim()}`;
    const emailBody = `
Severity: ${severity.toUpperCase()}
Reporter: ${userName}
Path: ${location.pathname + location.search}

Description:
${description.trim()}
    `.trim();

    // Open user's default email client
    window.location.href = `mailto:${emailTo}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    
    showToast('success', 'Email Opened', 'Please send the email from your default client to report the issue.');
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Button - Moved to bottom-left to avoid overlap */}
      <motion.button
        onClick={handleOpen}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: 'spring', stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed left-6 bottom-24 lg:left-8 lg:bottom-8 z-50
                   w-12 h-12 rounded-full flex items-center justify-center
                   bg-gradient-to-br from-primary-500 to-accent-500
                   text-white shadow-xl hover:shadow-primary-500/20
                   cursor-pointer focus:outline-none transition-shadow"
        title="Report an Issue"
      >
        <HelpCircle className="w-6 h-6" />
      </motion.button>

      {/* Modal Overlay and Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="issue-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[90]"
          />
        )}
        {isOpen && (
          <div key="issue-modal-wrapper" className="fixed inset-0 flex items-center justify-center p-4 z-[100] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="bg-[var(--bg-card-solid)] border border-[var(--border-subtle)]
                         w-full max-w-md rounded-2xl shadow-2xl overflow-hidden
                         pointer-events-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-hover)]/30">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-warning-500" />
                    Report an Issue
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Let Roy know what broke</p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                  disabled={loading}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Subject */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Subject <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Briefly describe the issue..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </div>

                {/* Severity */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Severity Level
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    disabled={loading}
                  >
                    <option value="low">Low (UI glitch, minor text error)</option>
                    <option value="medium">Medium (Annoyance, slow load, styling)</option>
                    <option value="high">High (Feature not working, logic error)</option>
                    <option value="critical">Critical (App crash, cannot submit data)</option>
                  </select>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Description <span className="text-danger-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Please details what happened, what you clicked, or any error messages you saw..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={loading}
                  />
                </div>

                {/* Context Info (Read-only) */}
                <div className="rounded-xl bg-[var(--bg-hover)]/30 border border-[var(--border-subtle)] p-3 text-[11px] text-[var(--text-muted)] space-y-1">
                  <div className="flex justify-between">
                    <span>Reporter:</span>
                    <span className="font-semibold text-[var(--text-secondary)]">{userName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Screen:</span>
                    <span className="font-mono text-[var(--text-secondary)] truncate max-w-[200px]" title={location.pathname}>
                      {location.pathname}
                    </span>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-semibold
                               text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={loading}
                    className="flex-1"
                  >
                    Send Report
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
