import { useEffect } from 'react';
import type { RefObject } from 'react';

export function useDialogFocus(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    // The ref may wrap the dialog (e.g. the mobile drawer) instead of being it.
    const ownDialog = root.closest('[role="dialog"]') ?? root.querySelector('[role="dialog"]') ?? root;
    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter(el => !el.matches(':disabled') && el.getClientRects().length > 0);
    const initial = focusables()[0];
    // preventScroll: portal panels can be unpositioned for a frame, and moving focus to them scrolled the page.
    initial?.focus({ preventScroll: true });
    const handleKey = (event: KeyboardEvent) => {
      const targetDialog = event.target instanceof Element ? event.target.closest('[role="dialog"]') : null;
      if (targetDialog && targetDialog !== ownDialog && !targetDialog.contains(root)) return;
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const list = focusables();
      const first = list[0], last = list[list.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open, ref]);
}
