import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, X } from 'lucide-react';
import Button from './Button';
import DatePicker from './DatePicker';
import CustomSelect from './CustomSelect';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { fetchShiftSummaryRows, sendShiftSummaryToTelegram } from '../../utils/api';
import { generateShiftSummary, getDefaultShift, splitTelegramText } from '../../utils/shiftSummary';
import type { Shift } from '../../utils/shiftSummary';

export default function ShiftSummaryModal() {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState(getDefaultShift);
  const [report, setReport] = useState<ReturnType<typeof generateShiftSummary> | null>(null);
  const [busy, setBusy] = useState<'loading' | 'sending' | null>(null);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const busyRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const online = useOnlineStatus();
  const close = () => { if (!busyRef.current) setOpen(false); };
  useDialogFocus(dialogRef, open, close);

  function changeSelection(date: string, shift: Shift) {
    setSelection({ date, shift });
    setReport(null);
    setError('');
    setSent(false);
    setAttempted(false);
  }

  async function preview() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy('loading');
    setError('');
    setReport(null);
    setSent(false);
    setAttempted(false);
    try {
      const rows = await fetchShiftSummaryRows(selection.date, selection.shift);
      setReport(generateShiftSummary(rows, selection.date, selection.shift));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load the shift. Please try again.');
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function send() {
    if (!report?.text.trim() || busyRef.current || attempted) return;
    busyRef.current = true;
    setBusy('sending');
    setAttempted(true);
    setError('');
    try {
      await sendShiftSummaryToTelegram(report.text);
      setSent(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not send the summary.');
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  return <>
    <button type="button" className="lab-button secondary" disabled={!online} onClick={() => {
      changeSelection(getDefaultShift().date, getDefaultShift().shift);
      setOpen(true);
    }}><Send size={16} />Shift summary</button>
    {open && createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6" onClick={event => {
        if (event.target === event.currentTarget) close();
      }}>
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="shift-summary-title"
          className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card-solid)] text-[var(--text-primary)] shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] p-5">
            <div>
              <h2 id="shift-summary-title" className="text-lg font-semibold">Shift activity summary</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Choose a shift, review the summary, then send it to Telegram.</p>
            </div>
            <button type="button" onClick={close} disabled={!!busy} aria-label="Close shift summary"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] disabled:opacity-50"><X size={20} /></button>
          </div>
          <div className="space-y-5 overflow-y-auto p-5">
            <fieldset disabled={!!busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
              <DatePicker label="Shift start date" value={selection.date}
                onChange={date => changeSelection(date, selection.shift)} />
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Shift</p>
                <CustomSelect label="Shift" value={selection.shift}
                  onChange={shift => changeSelection(selection.date, shift as Shift)}
                  options={[{ value: 'AM', label: 'AM shift (6 AM - 6 PM)' }, { value: 'PM', label: 'PM shift (6 PM - 6 AM)' }]} />
              </div>
            </fieldset>
            <p className="text-sm text-[var(--text-secondary)]">Times are in Philippine time (UTC+8). PM shift includes the following morning, before 6 AM. Samples from the last 3 hours are endorsed to the next shift and also included in that shift's summary.</p>
            <Button variant="secondary" onClick={preview} disabled={!!busy || !online || !selection.date} loading={busy === 'loading'}>
              {report || attempted ? 'Regenerate preview' : 'Generate preview'}
            </Button>
            {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-[var(--text-primary)]">{error}</p>}
            {!online && <p role="status" className="text-sm">Connect to the internet to load or send a summary.</p>}
            {report && <>
              <div className="space-y-2 text-sm" role="status">
                <p>{report.count} sample{report.count === 1 ? '' : 's'} in this summary, including incoming endorsements.</p>
                {report.warnings.map(warning => <p key={warning} className="rounded-lg bg-amber-500/10 p-3">{warning}</p>)}
                <p className="text-[var(--text-secondary)]">Review the automatic endorsements and recorded instructions below. You can edit the message before sending.</p>
              </div>
              <div>
                <label htmlFor="shift-summary-preview" className="mb-2 block text-sm font-medium">Message preview</label>
                <textarea id="shift-summary-preview" value={report.text} disabled={!!busy || attempted}
                  onChange={event => setReport({ ...report, text: event.target.value })}
                  className="min-h-72 w-full resize-y rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] p-3 text-base leading-relaxed text-[var(--text-primary)] focus:outline-2 focus:outline-primary-500 sm:text-sm" />
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{splitTelegramText(report.text).length} Telegram message(s). Long summaries are sent in order.</p>
              </div>
            </>}
            {sent && <p role="status" className="text-sm font-medium">Summary sent to Telegram.</p>}
            {attempted && !sent && !busy && <p className="text-sm">Check Telegram before regenerating and sending again. Some message parts may already have arrived.</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border-subtle)] p-4">
            <Button variant="secondary" onClick={close} disabled={!!busy}>Close</Button>
            <Button onClick={send} icon={<Send size={16} />} loading={busy === 'sending'}
              disabled={!report?.text.trim() || !!busy || !online || attempted}>
              {sent ? 'Sent to Telegram' : 'Send to Telegram'}
            </Button>
          </div>
        </div>
      </div>, document.body,
    )}
  </>;
}
