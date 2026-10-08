# Validation report · 2026-10-08

## Baseline

Before the redesign, TypeScript and the production build passed. The production bundle already exceeded Vite's 500kB chunk warning threshold (approximately 1.57MB JavaScript). The host's npm command launcher failed because its roaming npm-cli path was missing; direct Node invocation works.

Source/behavior audit identified a pre-existing AIR queue retry endpoint fallthrough and a page retry path that removed successfully sent records without writing reconciled history. Both were corrected. No API, type, or storage migration was made.

## Completed checks

- TypeScript: pass.
- Production build: pass; JavaScript approximately 1.57MB before gzip. The existing large-chunk warning remains. A newly observed standalone @theme warning was corrected before the final build.
- 16 isolated logic checks pass for ENVI/WATER/RawMats/AIR initial, highest, and next control numbers; mapped queued history dates/status; placeholder-expression and N/A fallback; RawMats normalization.
- Actual DOCX generator and existing template: pass. Synthetic data produces a valid ZIP/document.xml, replaces the APC placeholder, and renders a Passed result. Browser generation shows success. The in-app browser download event timed out, so the host's downloaded-file delivery was not confirmed.
- 18 shared light/dark text/status color pairs meet 4.5:1. See contrast.json. This is a token check, not a complete WCAG conformance certification.
- Eleven routes were smoke-checked at 360, 390, 768, and 1440px. All had their intended heading and no page-level horizontal overflow. See responsive-checks.json. Late-rendered controls found during deeper checks were labeled subsequently.
- Query-string intake layouts render for all four sample types.
- WATER: incomplete form disabled submission; required fields enabled it; offline submit added a durable queue entry with provisional control number. Offline retry retained the entry as failed; reconnect plus Retry All emptied the queue.
- WATER and AIR queued retries produced reconciled W26/A26 identifiers in history; mapped-date/status preservation is additionally covered by logic checks.
- Simulated history outage after server acceptance: the AIR record retained its A26 identifier in IndexedDB as Sent, disappeared from pending counts, and exposed no retry control. This prevents a cloud history failure from producing a duplicate submission. The confirmed backup is retained when history storage fails.
- ENVI: two custom swab points submitted as a bulk group under a shared control number. History exposed both records.
- AIR: method, sampling point, performer, time and submission exercised with synthetic services.
- RawMats: RFAF, ROH type, custom sample, source, receiver and time submitted successfully with a normalized returned control number.
- Reports: record edit dialog labels/focus checked; synthetic remarks persisted after Save to Sheet. Search and column controls are named. Record/control/status scrolling stays in the table container.
- History: disclosure operates with Enter/Space; sample dialog receives focus, dismisses with Escape, and restores its trigger.
- Mobile menu: every route remains available; focus is trapped, offscreen menu is inert, Escape restores the Menu trigger.
- Incubation: ENVI action navigates to /results?tab=ENVI&search=E26-001.
- Calendar: Next changed month, Today restored the current month, selected day opened three synthetic scheduled readings; dialog focus and close label checked.
- Themes: light/dark/system controls exercised; desktop light and mobile dark screenshots saved.
- Motion study: synchronizing vector reports the orbit animation; Reduce motion reports animation-name none; saved-state feedback checked.
- Figma: desktop and dark mobile layouts visually inspected; screen dimensions checked; native keyframes read back; same-page prototype destinations linked.

## Practical limits

Production authentication, Google Calendar writes, Telegram sends, live webhook behavior, and real cloud data were not exercised. They remain existing code paths. No production record was created or edited. System-level reduced-motion behavior is supported in CSS and Framer Motion and was source-checked; the browser did not provide an OS preference emulator, so the explicit prototype alternative was exercised.

The Figma layouts are editable design specifications rather than a runtime replica of schema-generated tables. Exhaustive assistive-technology testing and every conditional admin/Google setup flow were not run. The pre-existing Reports notice says some report categories are under construction; that notice and export logic were retained.

## Evidence and rerun

Screenshots: dashboard-desktop.jpg, dashboard-mobile-dark.jpg, motion-prototype.jpg.
Run the commands in ../README.md. The fixture preview replaces remote services only in its separate Vite configuration.
