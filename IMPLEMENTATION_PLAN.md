# Shared Kanban and integrated Excalidraw implementation plan

Date: 2026-10-10 (Asia/Taipei). Status: **APPROVED — user said “proceed”; local implementation complete, cloud activation pending configuration**.

The user approved dependency installation and implementation with “proceed”. No deployment, live database mutation or external sharing change has been performed. See docs/COLLABORATION_HANDOFF.md for the delivered architecture, bounded deviations and verification evidence. The older sample-logging plan is retained at the end as a historical appendix; its approval language does not apply to this proposal.

## 1. Repository findings

| Area | Evidence and implication |
| --- | --- |
| Framework | `package.json`: React 19, TypeScript 6, Vite 8, Tailwind 4, React Router 7, Framer Motion, Lucide. Add feature routes to this SPA; do not migrate frameworks. |
| Hosting | `vercel.json`, `api/*.ts`: Vercel Node functions and SPA rewrites. `vite.config.ts` proxies `/api` to localhost:3000. Production capabilities and account limits have not been inspected. |
| Login | `src/utils/auth.ts`, `src/hooks/useAuth.ts`: static password/PIN checks and browser-local session flags; Google sign-in uses Firebase Auth. `src/App.tsx` also creates anonymous Firebase sessions. These browser flags and anonymous identities are insufficient for shared-resource authorization. |
| Roles and sharing | No server-backed workspace membership or viewer/editor/admin role model was found in inspected source. Firestore `users` stores names, PINs, and UIDs; shared configuration is global. A new explicit membership model is necessary; existing display names or PINs must not grant roles. |
| Storage | `src/utils/db.ts`: IndexedDB queue and Firestore history. `api/_supabase.ts`: server-side Supabase service-role client; `api/supabase-samples.ts` mirrors samples. No committed schema migrations, Firestore rules, or collaborative document provider were found. Live policies are unverified. |
| Existing API security | The inspected Supabase sample handler has no bearer-token or membership verification and writes through a service-role client. New collaboration APIs must use independent authorization and database policies; do not copy this handler's trust model. Existing lab API hardening beyond integration changes is a separate scope. |
| Google integration | `api/_sheets.ts` uses `GCP_CREDENTIALS_JSON` or `GOOGLE_CREDENTIALS` service-account credentials with a Sheets scope. Firebase Google login does not currently authorize Drive checkpoint writes. n8n documentation describes older Sheets OAuth workflows; it is not a ready-made Drive document store. |
| Design | Reuse Precision Lab shell, blue/teal tokens, Inter typography, light/dark themes, Lucide icons, and existing SVG ScienceGraphic assets. Relevant files: `src/design/precision-lab.css`, `src/index.css`, `design/README.md`, `design/motion.md`. |
| Components | Reuse Layout, Sidebar/mobile Menu, PageIntro, Button, TextInput, CustomSelect, Toast, StatusBadge, OfflineBanner, and useDialogFocus where their contracts fit. Bottom navigation can retain its primary lab actions, exposing collaboration through the existing Menu. |
| Motion | `src/design/motion.ts`: 140ms feedback and 240ms panels; app MotionConfig honors reduced motion. `useMotionActivity` and CSS pause offscreen/hidden decorative motion. No separate global user performance setting was found. |
| Verification | Existing Node test files use `node:test` and TypeScript transpilation. Design fixture/regression/contrast tools exist. Current `tsconfig.json` includes only `src`, so production frontend compilation alone does not verify API types. |
| Instructions | No AGENTS.md found in the repository file search or checked ancestor directories. GEMINI.md contains a commit-and-push rule; no commit was requested. Existing unrelated untracked image must be preserved. |

## 2. Proposed architecture and decisions

### Identity, workspace, and permissions

Retain Firebase Google sign-in as the authenticated identity for collaboration. Require a verified, non-anonymous Firebase user, a validated token from the configured project, and active server-managed membership. Legacy PIN/password-only users receive a clear Google sign-in requirement for these new routes; existing sample logging continues under its current login model. Supporting those methods for collaboration requires a separate secure credential migration, not mapping a client-supplied name to an editor.

Proposed sharing scope: one initial **QC microbiology workspace**, with all its boards and drawings shared among active members. Persist workspace IDs from the start. Memberships map Firebase UID strings to `admin`, `editor`, or `viewer`; no public room IDs, implicit domain-wide enrollment, or automatic enrollment of every Google account. If a live membership model is supplied during setup, adapt to it rather than creating a competing authority. The administrator bootstrap UID and member roster need confirmation.

- Admins and editors can create, read, edit, rename, reorder/move, delete, restore, and import shared content.
- Viewers can read/export and pan/zoom drawings. They cannot mutate documents, upload assets, restore resources, or import into the shared workspace.
- Only admins can manage memberships and the Drive destination. Admin bootstrap is an audited provisioning action, not a frontend password.
- Recheck workspace membership for each API mutation and authorized asset request; apply RLS to exposed tables and private storage. Firebase UIDs are text, not assumed to be Supabase UUIDs. Authorization uses verified subject plus database membership, never user-editable metadata.
- Reject anonymous, expired, wrong-project, absent-membership, cross-workspace, and viewer mutation requests, including alternate direct Data API paths.

### Durable state and transport

Use the existing **Supabase Postgres project** for authoritative collaboration state and private asset storage; leave sample history and the sample mirror unchanged. Use authenticated HTTP Vercel APIs for validated operations and **Supabase private Realtime** for committed revision notifications and presence. No in-memory room or process-local lease is authoritative. This reuses an installed SDK and supports multiple backend instances.

Configure Supabase's Firebase third-party Auth integration and the Firebase `role: authenticated` claim. That claim is a Postgres access role, not an application editor role; database memberships decide permissions. Provision claims through an admin-only setup tool and documented onboarding. Use a publishable client key, never the service-role key in frontend code. Prefer caller-scoped RLS connections for operations; restrict any privileged worker/RPC capability to its specific job.

Private Realtime publishes resource/revision notifications after transaction commit, not uncommitted document payloads. Clients fetch authorized deltas. Presence includes minimal participant identity, cursor and expiry; throttle it and validate payload sizes. Disable client document broadcasts. Private room policy allows authorized read/presence only and distinguishes editors from viewers where needed.

Realtime authorization is cached during connections. Rotate room generations atomically on membership removal or resource deletion; stop publishing to the old generation. Active members obtain the new room through an authorized API. Periodically revalidate membership, refresh tokens, expire presence, and test revoked connections; client-side disconnect alone is not an authorization boundary. If safe presence/channel revocation cannot be established in the spike, use server-checked HTTP presence polling until it can; do not ship an insecure room.

Keep revision-based HTTP catch-up as the reconnect and realtime-outage fallback. Vercel now documents WebSocket support in beta, so the choice is to reuse managed Supabase transport rather than depend on that beta or build cross-instance pub/sub. Confirm actual project availability and limits before infrastructure setup.

### Data and operation contract

Proposed tables: workspaces, memberships, resources (board/drawing, name, revision, generation, deleted_at), columns, notes, note_text_updates/checkpoints, drawing_elements, assets, operation_receipts, revision_events, drive_destinations, drive_checkpoints, and drive_jobs. Add indexes by workspace/resource/revision and private storage policies. Exact migrations will be generated using the installed Supabase CLI after approval; no migration filenames are invented here.

Every mutation contains a client/session ID, stable operation ID, resource generation, relevant base revision/field version, and bounded payload. One atomic database commit checks membership and generation, deduplicates the operation, applies changes, increments revision, records its result/event, and enqueues necessary checkpoints. A duplicate ID with a different payload is rejected; replaying the same ID returns its original result.

Use serializable resource mutations or row locks with compare-and-swap. Persist normalized ordering and use deterministic ID tie-breaks for concurrent inserts/moves; reject references to deleted columns. Structural changes are atomic, including column deletion and note reassignment. Conflicting metadata updates use field-version checks and return the current state plus preserved submitted draft for review, rather than silently overwriting it. Server receipt order determines accepted conflicting structural operations; client wall clocks do not decide winners.

Store note body edits as Yjs updates plus state vectors/checkpoints. A backend instance loads current state, validates and merges updates, then commits via revision compare-and-swap; on contention it reloads/remerges within bounded retries. The event, receipt, and resulting checkpoint commit together. Yjs update merging is the text conflict mechanism; metadata is deliberately separate. Compact updates with retained state vectors and replay tests, keeping deletion generations independent of the CRDT.

New IndexedDB storage is dedicated to collaboration (do not change SampleLoggerDB v2 just for this feature). It stores acknowledged snapshots, pending operations, and conflict drafts keyed by identity/workspace/resource. Persist before send, acknowledge only after durable backend success, retry with backoff/jitter, refresh identity on reconnect, and recover missed revisions before rebasing pending work. Never replay another user's queue after account switching. Revoked permissions stop sending while retaining a local draft for the user.

Deletion uses retained tombstones and explicit restore operations. Old-generation updates cannot resurrect a deleted note, column, drawing element, or resource. Restore increments generation and requires current authorization. Proposed trash retention is 30 days; do not purge until retention is approved and recovery is tested. Note deletion has immediate local Undo backed by the same authorized restore protocol; resource trash remains available after refresh.

Expose four independent UI states: connection, pending local operations, backend committed revision/save status, and Drive checkpoint revision/status. A backend acknowledgment must never be labeled as a Drive save.

### Kanban UI

Provide a board list, create/rename/trash/recover actions, and initial To do / In progress / Done columns. Support column creation, rename, reorder, and deletion with an explicit choice to move its notes to a selected live column or trash those notes; show counts and never discard them implicitly.

Notes have title, collaborative body, color, column, and order. Card editing and an open sidebar bind to the **same Y.Text** and shared note metadata store, including selection/IME handling; edits must not replace the entire CRDT text from a stale textarea value. The sidebar includes title/body, color, column and explicit move controls. Conflicting title/color drafts appear in a review UI offering keep remote or reapply draft with a fresh field version.

Use an accessible maintained drag library with pointer/touch and keyboard sensors. The full non-interactive header surface initiates drag; header buttons/inputs remain operable. Space picks up, arrows move, Escape cancels, drop announces the new position; explicit Move to column / earlier / later controls provide another route. Inline text selection must not start a drag.

On mobile, horizontally scroll columns with an accessible labeled column selector that scrolls/focuses the selected column. Virtualize large columns with stable keys, cached measurements and memoized unchanged notes; keep focused, selected, and dragged cards mounted. Test virtualized keyboard movement, screen-reader announcements, touch scrolling and dragged overlays together.

### Excalidraw integration and release gate

Lazy-load the official `@excalidraw/excalidraw` editor and its supported CSS/assets in a route chunk; verify React 19/TypeScript compatibility and exported APIs before pinning a version. Excalidraw's React editor is not a complete persistence/collaboration backend: implement the provider explicitly.

Persist element-level state including deletion tombstones, IDs, versions/nonces, ordering, bindings/group references and referenced binary images. Use the pinned editor's supported reconciliation semantics with deterministic ties, plus server generation/deletion checks. Send changed elements in batches, not a blind full-scene replacement; resource revisions protect consistency and concurrent additions survive. Assets use private, workspace-scoped storage with size/MIME/hash checks and authorized reads; a drawing is only fully saved once referenced image uploads are acknowledged.

Keep scroll position, zoom, selection and active tools personal. Reflect authorized presence/cursors via the editor collaborator API. Reconcile incoming elements without replacing personal appState, apply `CaptureUpdateAction.NEVER` for remote updates, ignore identical own echoes using acknowledged operation IDs/content signatures, and defer element reconciliation during pointer gestures and text/IME composition. Flush queued reconciliation safely after gesture completion, then rebase pending local changes.

**Phase-1 release gate:** demonstrate that local undo/redo does not remove or revert another editor's work, including same-element interleaving, remote deletion, refresh and image edits. NEVER capture alone is not proof. If the pinned editor's history/reconciliation semantics fail these cases, implement a local-origin operation history adapter or stop that path for a revised design; multiplayer drawing will not be declared complete with failing undo isolation.

Support validated `.excalidraw` import and canonical export with required binary files, plus official PNG/SVG exports. Imports create a new resource by default; replacement requires explicit editor choice and generation reset. Exclude personal camera/selection from canonical snapshots. Sanitize/validate imported structure, links, file references, sizes, and export rendering inputs.

Fit drawing computes visible bounds with reserved toolbar/action-panel padding on each viewport. Fullscreen changes CSS/fullscreen state on a stable canvas container; never remount or reparent the editor into a different React root. Provide Exit fullscreen, Escape and browser fullscreenchange handling, a CSS fallback where necessary, inert background controls, focus containment and exact focus restoration. Test history, pending operations and editor instance identity across toggles.

### Google Drive checkpoints and recovery

Reuse the existing Google service-account credential source where suitable, but create a separately scoped Drive client instead of changing Sheets authorization silently. Preferred destination is a dedicated folder in a Shared Drive where the service account can create files. Google notes that service accounts have no storage quota and cannot own files, so a normal personal My Drive folder may require a user OAuth refresh-token integration instead. Folder type, capabilities and account permissions must be verified before live saves.

An admin sets the destination folder through a server-authorized settings API. Validate folder MIME type, parent/shared-drive metadata and create capabilities. No Drive permission creation/update is performed automatically. Application membership determines interactive app access; Drive ACLs independently determine access to exported snapshots, which can expose workspace content to existing folder readers. Show that scope clearly during configuration. Drive previews are read-only artifacts; multiplayer editing remains in the application.

Write versioned **immutable canonical checkpoints**: Kanban JSON (schema version, IDs/order, body text and CRDT recovery data, relevant tombstones/generations) and standard `.excalidraw` JSON with its required binary files. Add readable Kanban HTML/CSV exports with escaping and formula-injection protection, and idle-generated drawing PNG/SVG previews. Store app/workspace/resource/checkpoint identifiers and content hashes in appProperties and the backend manifest.

Use a durable Postgres outbox with resource-scoped lease/fencing token and unique checkpoint identity. A protected scheduled worker processes bounded batches; configuration depends on actual Vercel scheduling limits (or an approved existing scheduler). Every payload corresponds to an immutable committed backend revision. Coalesce routine checkpoints while retaining failures, record attempt/error/backoff/next retry, and make retry available to editors. A user retry can trigger the same worker but unattended retry requires the scheduler.

Prefer new immutable files over updating externally editable files, avoiding a read-before-write overwrite race. Persist a preallocated Drive file ID/checkpoint identity before upload where supported and reconcile uncertain responses before retrying; do not duplicate a file after a timeout. Verify hashes and completion metadata before marking saved. Check recorded files for external changes, moves, trash/deletion and folder capability changes. Mark conflicts and require review; do not overwrite, move files back, recreate missing checkpoints, or redirect writes silently. The backend manifest selects the latest successfully verified checkpoint; no mutable Drive 'latest' file is needed. Retention cleanup is out of the initial implementation scope.

Import canonical snapshots from the authorized destination through a validated recovery flow. Recover into a new resource/generation by default and keep prior history; inspect schema/workspace identity and asset integrity. Preview recovery before committing. External edits remain visible as conflicts until reviewed. Test live upload, permissions, asset export and recovery only against a dedicated approved test folder; mocked tests cannot establish live Drive saving.

## 3. Phases, dependencies, and concrete file map

Paths below are proposed repository-relative implementation targets. Existing files are named explicitly; new directories will be added only after approval.

| Phase | Depends on | Work and files |
| --- | --- | --- |
| 0 — inspection/approval | User request | Update `IMPLEMENTATION_PLAN.md`, `task.md`; preserve historical plan appendix. No feature changes. |
| 1 — foundations/spikes | Approval; staging service setup | Add `api/_collaborationAuth.ts`, `api/_collaborationStore.ts`, `api/workspace.ts`, `src/utils/collaboration/auth.ts`, `src/hooks/useWorkspace.ts`, `src/types/collaboration.ts`, `tools/collaboration/provision-members.ts`; CLI-generated `supabase/migrations/` and `supabase/config.toml`. Update `src/hooks/useAuth.ts`, `src/utils/auth.ts`, `src/components/auth/LoginPage.tsx`, `src/App.tsx` narrowly for real collaboration identity. Add editor/history and channel-revocation spike tests. Update `.env.example`, `package.json`, lockfile only now. |
| 2 — durable operations | Phase 1 gates | Add `api/collaboration.ts`, `api/collaboration-assets.ts`, `src/utils/collaboration/{client,outbox,text,reconcile,assets}.ts`, `src/hooks/useCollaboration.ts`, `src/utils/supabase.ts`, `tests/collaboration-{permissions,operations,text,reconnect}.test.cjs`. Add atomic RPCs, RLS/storage policies and generation guards through migrations. |
| 3 — Kanban | Phase 2 | Add `src/pages/Kanban.tsx`, `src/components/kanban/{BoardList,KanbanBoard,KanbanColumn,StickyNote,NoteSidebar,ColumnDialog}.tsx`, `src/design/collaboration.css`, `tests/kanban.test.cjs`. Update `src/App.tsx`, `src/components/Layout/Sidebar.tsx`; reuse existing Menu. Add trash/recovery and conflict review components. |
| 4 — drawings | Phase 1 undo spike and Phase 2 | Add `src/pages/Whiteboard.tsx`, `src/components/whiteboard/{DrawingList,ExcalidrawEditor,CanvasFrame}.tsx`, `src/utils/collaboration/{drawing,export}.ts`, `src/hooks/useCanvasFullscreen.ts`, `tests/drawing-reconciliation.test.cjs`; extend API/asset code. Add stable fullscreen/focus behavior and exports. |
| 5 — Drive | Phases 2–4; folder/credential readiness for live test | Add `api/_drive.ts`, `api/drive-settings.ts`, `api/drive-checkpoints.ts`, `api/drive-worker.ts`, `src/components/settings/DriveDestination.tsx`, `src/utils/collaboration/drive.ts`, `tests/drive-checkpoints.test.cjs`. Update `src/pages/Settings.tsx`; add durable outbox/checkpoint migrations. Update `vercel.json` only for the approved scheduler and confirmed limits. |
| 6 — verification/polish | Phases 3–5 | Add `tests/e2e/collaboration.spec.ts`, `playwright.config.ts`, `tools/collaboration/profile.ts`, `docs/collaboration/{setup,architecture,recovery,handoff}.md`, `design/validation/collaboration.md`; extend design fixture/regression/contrast tools with synthetic collaboration fixtures. Add separate API typecheck configuration because current build excludes `api`. Fix significant audit/profile findings. |

Dependencies proposed after approval: official Excalidraw, Yjs, firebase-admin for verified tokens/provisioning, a React-19-compatible maintained drag library (prefer dnd-kit if compatibility checks pass), a virtualizer (prefer TanStack Virtual), Playwright test tooling and an accessibility audit tool. Reuse installed Supabase, googleapis, idb, Framer Motion and Lucide. Pin selected versions after checking official compatibility/security guidance. No standalone collaborative text service is required for the proposed operation transport.

Update task.md after each phase with checkbox progress, blockers, exact commands/results, affected scenarios, artifact paths, and verified versus unverified service behavior.

## 4. Acceptance and verification

### Functional and security matrix

| Area | Required evidence |
| --- | --- |
| Membership | Two independent editor sessions and a viewer session; unauthorized/cross-workspace/wrong-project/expired/anonymous requests rejected; viewer mutations rejected through APIs, RPC/Data API, assets and collaboration paths. Revoked membership stops operations and access to new rooms/data. |
| Board lifecycle | Initial columns; resource/column/note create/rename/order/move/delete; explicit occupied-column handling; note Undo and trash restoration survive refresh; old operations cannot resurrect deleted content. |
| Editing | Type inline with sidebar open in both directions; same shared body, IME composition and selection preserved; two editors merge simultaneous body changes; title/color conflict draft remains available after reconnect/refresh. |
| Drag/accessibility | Full-header pointer/touch drag, keyboard pickup/move/cancel/drop, movement controls, focus and announcements; mobile column selector; virtualization retains focused/dragged cards. |
| Drawing | Simultaneous additions and same-element changes, participant/cursor lifecycle, image upload/read after refresh, element tombstones, personal camera/selection, own-echo skip, active-gesture deferral, local undo/redo isolation, invalid import rejection, canonical/PNG/SVG exports. |
| Fullscreen | Exit button, Escape and native exits; background inert/focus contained; focus restored; no editor remount, history loss or dropped pending edits; Fit drawing respects toolbars on all viewports. |
| Persistence | Refresh after acknowledgment, disconnect before/after commit, retry after ambiguous response, duplicate replay/different-payload rejection, out-of-order deliveries and multi-instance contention; authoritative backend and all four UI statuses agree. |
| Drive | Mock errors plus live isolated-folder tests when configured: checkpoint with assets, readable exports/previews, failure/retry, simultaneous workers, uncertain upload completion, externally modified/moved/deleted files, missing permissions and canonical recovery. No permission broadening. |

### Commands and rendered inspection (after approval)

1. Run existing `node --test tests/*.test.cjs`, new focused protocol tests, a separate API TypeScript check, and `npm run build`. Use the documented direct Node launchers if npm on this host fails. Establish the baseline first and separate existing failures from regressions.
2. Start the API with `npm run dev:api` and the Vite app with `npm run dev` using compatible ports; inspect the actual rendered app using Playwright. Synthetic design fixtures support deterministic UI tests but do not replace authenticated backend tests.
3. Record the user's actual browser viewport when available through browser tooling; do not claim it has been measured now. Test that size, desktop 1440x900, mobile 390x844 and narrow 320px, light/dark modes, reduced motion and touch/keyboard. Record browser/version/device/DPR.
4. Run editor/editor/viewer contexts against an isolated staging workspace; use direct HTTP/RPC negative tests in addition to UI-disabled controls. Verify legitimate identities and revoke memberships during live sessions.
5. Audit headings, labels, focus order/restoration, dialogs/inert background, status announcements, sticky-note contrast and non-color cues, touch targets, exports and keyboard flows. Run automated accessibility checks and manual keyboard/screen-reader checks; fix significant findings.
6. Profile synthetic boards with 100, 1,000 and 5,000 notes across 3 and 10 columns, and drawings with 100, 1,000 and 5,000 elements plus representative embedded images. Record exact text/image sizes, operations, concurrent users, machine/browser conditions, frame intervals p50/p95, frames exceeding 16.7/33.3ms, long tasks over 50ms, memory where supported, load/pending-save latency and bundle splitting. Compare before/after and investigate sustained drag/drawing jank or avoidable long tasks; do not assert universal smoothness from throttled/emulated devices.
7. Cache stable card content/references/measurements during dragging, use bounded transform/opacity feedback for local lift/drop only, avoid remote animation replay, batch drawing writes, throttle presence (initial target <=10Hz), and generate previews after idle (initial target >=1s without edits). Tune these targets from measurements. Reduced-motion and hidden-document behavior must remain effective.
8. Record screenshots/traces, datasets, results, limitations and every unverified case in task.md and handoff documentation. Live Drive saving requires a successfully fetched/checksummed checkpoint and a tested recovery, not merely a configured client.

## 5. Required capabilities, credentials, and unresolved decisions

Do not paste secrets into the plan or client configuration. Existing `.env` contents and live account credentials were not inspected.

| Requirement / decision | Proposed default or required input |
| --- | --- |
| Plan approval | Approve the architecture/phases before implementation. Approval does not authorize deploying or changing external sharing. |
| Workspace and login eligibility | One QC workspace, Google-verified members for collaboration. Confirm whether legacy PIN/password users must also participate; that changes the identity migration scope. |
| Initial administrator and roster | Supply/confirm administrator Firebase UID and member UIDs/roles through a secure provisioning process. Never infer roles from display names or local flags. |
| Firebase server credentials | Firebase project ID and server-side admin credentials with token verification/provisioning capabilities; deployed Google provider and authorized domains. Reuse an existing credential only after confirming it belongs to the Firebase project and has suitable permissions. |
| Supabase | Existing URL/service-role key stay server-side; add publishable client key/URL. Need authorized staging database migration access, Firebase third-party Auth configuration, role-claim provisioning, private Realtime and private Storage availability. Verify live schema/RLS before changes. |
| Hosting | Confirm Vercel runtime/body/function-count limits, region, Realtime quotas and scheduled retry capability. Upload large assets directly to private storage under validated policy rather than exceeding function payload limits. |
| Drive authorization/destination | Enable Drive API for the credential project; confirm a dedicated Shared Drive folder and writer-capable service account, or use administrator-authorized user OAuth for My Drive (client ID/secret and server-held refresh token). Existing Sheets permission is not proof of Drive write access. Folder sharing must be configured explicitly by its owner. |
| Scheduling | A protected Vercel Cron worker with CRON_SECRET if the plan permits the needed frequency; otherwise an explicitly approved existing scheduler. Suggested checkpoint debounce 30s, with manual save/retry and scheduled durable retry. Actual retry SLA depends on scheduler availability. |
| Trash and import behavior | Proposed 30-day retention, no initial purge; imports recover into new resources. Confirm a different retention/replacement policy if needed. |
| Test data/accounts | Isolated staging workspace, editor/editor/viewer identities and a dedicated test folder. Automated Google login may require preauthenticated test sessions; do not place auth state or tokens in Git. |
| Device measurement | Actual viewport/browser are not yet known. Record them during approved rendered verification; emulation is not physical-device evidence. |
| Excalidraw risk | Supported reconciliation/history APIs and React compatibility must pass the phase-1 spike before multiplayer implementation is accepted. |

If service access is unavailable after approval, implement and verify the local contracts/fixtures and clearly record live integration as blocked/unverified. Do not silently swap backends, claim live saving, or weaken permissions to make a demo work.

## 6. Official references checked during planning

- [Supabase Firebase authentication integration](https://supabase.com/docs/guides/auth/third-party/firebase-auth): token integration, provisioning and project checks.
- [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization): private channels and cached authorization, which requires explicit revocation handling.
- [Supabase changelog](https://supabase.com/changelog): checked for platform changes; the markdown endpoint was unsupported by the browsing tool. Recheck relevant changes before implementation.
- [Vercel WebSockets](https://vercel.com/docs/functions/websockets): current beta availability, reconnect and persistent-state concerns; no assumption that the actual project uses beta capability.
- [Excalidraw imperative API](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api): supported remote update capture control; undo isolation still needs tests.
- [Yjs document updates](https://docs.yjs.dev/api/document-updates): collaborative update/state-vector primitives.
- [Drive uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [Shared Drives](https://developers.google.com/workspace/drive/api/guides/about-shareddrives), [Drive errors](https://developers.google.com/workspace/drive/api/guides/handle-errors), and [Drive changes](https://developers.google.com/workspace/drive/api/guides/manage-changes): checkpoint delivery and capability/conflict handling.

## Historical appendix — previous sample-logging plan

The following content is preserved for context only. It does not authorize this new implementation.

# Task Implementation Plan and Code Audit

## 1. Task Description
Enhance the offline capabilities, performance, and security of the "UL Sample Logger" application, ensuring it aligns tightly with the automated workflow defined in n8n and Google Sheets.

## 2. Refined Findings & Strategy (Based on Design Intent)

### A. Offline Control Number Logic
**The Current State:** When offline, the app currently defaults to generating `-001` for the sequence because it cannot see the latest control number in Google Sheets.
**The Fix:** 
1. **Frontend:** We need to update `generateNextControlNumber` to leverage the local Firebase/IndexedDB `history` cache to find the highest control number logged locally. If no local history exists, it can safely start at `-001`.
2. **n8n Backend (The Source of Truth):** n8n is already written to calculate the control number itself! However, we need to ensure that when a queued item eventually syncs, the frontend updates its local history with the *final* control number n8n generated, not the placeholder it generated offline.

### B. Security Improvements
1. **API Keys for n8n Webhooks:** We will add a simple API Key header requirement in the n8n workflows (`x-api-key`) and pass this key from the React frontend as an environment variable (`VITE_N8N_API_KEY`).
2. **Credentials Management:** Move the sensitive credentials out of `src/data/constants.ts` and `Settings.tsx` into a more secure, build-time environment setup.

### C. n8n Scalability Bottleneck
**The Current State:** The n8n "Get existing rows" node pulls the *entire* sheet every time.
**The Fix:** We will optimize the n8n workflow guide. Since the sheet is categorized by month (e.g., `MAY ENVI`), we can configure the n8n node to only fetch the `CONTROL #` column (Column A) or limit the search, drastically reducing the payload size. Alternatively, we can rely on n8n to only pull the last X rows if the workflow allows it.

## 3. Implementation Phases

### Phase 1: Fix Offline Control Numbers (Priority 1)
1. **Update `src/utils/db.ts` & `src/utils/controlNumber.ts`:**
   - Create a helper to query the local `history` object store for the highest sequence number matching the requested `sampleType` and date.
   - Inject this highest number into `generateNextControlNumber` when offline.
2. **Update `src/pages/NewSample.tsx`:**
   - When a queued item finally succeeds via `sendToWebhook`, ensure the returned `result.controlNumber` from n8n updates the local history entry.

### Phase 2: Implement Webhook Authentication (Priority 2)
1. **Update Frontend (`api.ts`):** Inject `x-api-key: import.meta.env.VITE_N8N_API_KEY` into the webhook headers.
2. **Update Documentation (`SETUP_GUIDE.md`):** Add instructions to add a "Header Auth" or "Header validation" step in the n8n webhook nodes.

### Phase 3: Error Handling & Cleanup
1. Ensure Firebase offline persistence is robust and UI surfaces offline/online state cleanly.

### Phase 4: Mobile-Friendly Live Sheet View (New Feature)
**The Goal:** Provide a read-only, mobile-friendly page within the app that reflects the live data currently in Google Sheets, eliminating the need to open the Google Sheets app to verify submissions.
**The Fix:**
1. **n8n Backend:** Create a new webhook workflow in n8n (e.g., `/webhook/get-sheet-data`) that accepts a requested sheet tab/month and returns the rows as JSON.
2. **Frontend:** Create a new page (e.g., `LiveSheetView.tsx`) with a mobile-optimized card layout (instead of a wide table) to display the fetched records. Add a refresh button to pull the latest live data.

## 4. Open Questions
- None at this time, proceeding to Phase 1 based on user confirmation.
