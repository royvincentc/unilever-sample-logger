# Shift Summary Implementation Plan

**Goal:** Send a daily AM/PM activity summary to the existing Telegram destination.

**Design:** Dashboard action opens a shift/date chooser, then an editable preview.
AM is [06:00, 18:00); PM is [18:00, next-day 06:00), in Asia/Taipei.
The date identifies the shift's start day. Before 06:00 the default date is
yesterday. Read the configured Google Sheet directly, including both years for
a December 31 PM shift. Fail on incomplete fetches rather than sending a partial
report. ENVI uses swabbing timestamps and ANALYZED BY; Water uses sampling
timestamps and ANALYZED BY; materials use receipt timestamps, ANALYZED BY then
RECEIVED BY. The last three hours of a shift are automatically endorsed to the
next shift. The receiving report also includes those three hours before its
start, tagged Endorsed by Night Shift/Dayshift. Preserve explicit handoff text.
Use existing controls and focus hook.
No new dependencies, credentials, automation, or sheet writes.

**Approach:** Reuse /api/sheet-data and /api/telegram. A pure formatter supports
focused tests; a small modal owns the review/send flow. The mirror and local
history are unsuitable because their data may be stale or omit personnel.

## Tasks

- [x] Add failing formatter tests for boundaries, midnight/year rollover,
  grouping, blank personnel, header variations, invalid dates and handovers.
- [x] Implement formatter and verify those tests pass.
- [x] Add direct-sheet loading and sequential Telegram message splitting with
  tests for failures, preventing silent partial reports or partial-send retries.
- [x] Add dashboard modal using existing Button, DatePicker, CustomSelect and
  useDialogFocus. Changing shift/date invalidates the preview; disable duplicate
  sends. Keep timestamps and batch identifiers readable.
- [x] Run focused tests, TypeScript and desktop/mobile browser checks with
  mocked data. Review the final diff.

## Decisions

- Receipt time determines material membership because analysis has no reliable
  time of day. Display analyst attribution independently as requested.
- Missing/unusable timestamps are excluded with a visible warning.
- Compress Leepack and numbered storage-tank swab points to Leepack/STn.
  Combine matching equipment, exact timestamp, analyst and endorsement text;
  retain the underlying sample count. Other sample categories stay uncompressed.
- ENVI and Water without ANALYZED BY are attributed to Unspecified.
- Outgoing handovers appear in a separate section, automatically for activity
  in [03:00, 06:00) for PM or [15:00, 18:00) for AM, and for explicit next-shift
  handovers. Incoming handovers appear in their usual category with the source
  shift tagged. Sampling/swabbing/receipt time determines membership; personnel
  attribution uses the recorded analyst. No actual acceptance record is written.
- Endorsement text remains attached to the sample. No inference from status.
- Verification must not send messages to the real Telegram chat.
- Review caught dropped instructions in outgoing handovers; retain the complete
  endorsement text and recipient in the sample line.
- Browser regression exposed disabled Motion buttons with tabindex=0 in the
  shared focus trap and Escape closing both the calendar and its parent modal.
  Filter :disabled elements and let the active nested dialog handle its keys.

## Verification

- Formatter: 13 tests passed, including analyst attribution, swab compression,
  all-category automatic incoming/outgoing handovers and New Year boundaries.
  Notes without endorsement keywords are retained and prevent distinct
  instructions from being collapsed together.
- API and existing control-number regression: 15 tests passed. API tests use
  the real shift-window and message-splitting helpers.
- Browser: 4 tests passed at 1440px/390px, including focus trapping/restoration,
  axe checks scoped to the modal, editing, AM/PM preview invalidation, failed
  sheet reads and failed sends. Verified an AM outgoing sample reappears in the
  PM preview as an incoming endorsement with analyst attribution.
  All remote-service responses were mocked.
- TypeScript --noEmit and git diff --check passed.
- Read all three live tabs for November 4, 2026 AM: 25 eligible rows
  (16 ENVI, 5 Water, 4 materials). Rechecked the saved live snapshot after the
  attribution/compression changes: ENVI renders three equipment lines attributed
  to CANOY (Leepack) and NUEVA (ST3/ST2); the tanks appear as outgoing endorsements
  in AM and incoming endorsements in PM. Water groups under CODINERA/NUEVA.
  Material 26-1276 is excluded for incomplete time
  `04:`; two historical date warnings also remain visible.
- No real Telegram send, full build, or deployment.
