# Shared Kanban and Excalidraw progress

Updated: 2026-10-10 (Asia/Taipei).
Status: **Local implementation and verification complete; cloud activation and live verification pending operator configuration.**

## Delivered

- [x] Read attached request; inspect repository/auth/storage/hosting/design.
- [x] Present repository-specific plan/task before implementation; preserve historical plan.
- [x] Receive explicit approval: user said **proceed**.
- [x] Verified Google identity, explicit admin/editor/viewer membership, HTTP checks, SQL RLS and server-only mutations.
- [x] Atomic revisions, receipts/deduplication, Yjs merge, metadata conflicts, generations/tombstones and durable outbox.
- [x] Kanban libraries, columns/notes, synchronized inline/sidebar bodies, full-header pointer/keyboard dragging, movement controls, trash/Undo and virtualization.
- [x] Lazy official Excalidraw, persisted elements/images, personal camera, non-history remote reconciliation, gesture deferral, presence/cursors, imports/exports and stable fullscreen.
- [x] Admin Drive destination, immutable verified checkpoints, fenced leases, coalesced unclaimed jobs, retained failures, conflict protection and recover-as-new-resource UI.
- [x] Local tests/build, rendered inspection, accessibility/design review, profiles and handoff.
- [x] Preserve unrelated user image and incumbent design files. No deployment, live migration, Drive upload or sharing change performed.

## Final evidence

- `npm test`: **23 existing + 14 collaboration tests passed** (protocol, isolated PGlite SQL/RLS/receipts/CAS/coalescing/leases, mocked Drive safety).
- `npm run test:e2e`: **9 Chrome browser tests passed** (inline/sidebar sync, pointer/keyboard header dragging, move/delete/Undo, editor/editor/viewer, fixture viewer API rejection, offline/reload, drawing undo/redo, same-element remote styling, remote deletion, gesture deferral, image persistence and actual canonical/PNG/SVG exports, stable fullscreen/Exit/Escape/focus, mobile/reduced motion).
- Final `npm run typecheck:api` and `npm run build`: passed. Large-chunk warnings remain; editor is lazy-loaded.
- Actual Vite app started on 5174; Chrome rendered /kanban -> existing /login. Authenticated cloud resources unavailable.
- Isolated localhost:5191 preview uses real UI/protocol plus substituted identities and in-memory HTTP data; fixture routes/auth are absent from production.
- Captures: 1440x900, 390x844, browser-tool measured 1036x578, 320px dark, official-editor desktop spike and empty drawing viewer mobile. Physical device unknown.
- Axe found no serious/critical issues in tested board state. One-time design detector returned []. Independent reviewer disposition **ship** at six screenshot/source states; independent documentation preserves incumbent files and records drift/missing separate direction brief.
- Profile: 100/1,000/5,000 notes across 3/10 columns and simple shapes. Single-column p95 18.3–18.7ms, 29–45 mounted notes; simultaneous-column stress p95 35.4–53ms, 39–65 mounted notes. Drawing idle p95 18.3–18.6ms. Conditions/raw long tasks in design/validation. No universal smoothness claim.
- Compatible audit fixes removed the critical advisory; **31 remain: 21 high, 8 moderate, 2 low**. Breaking downgrade suggestions were not applied.

## Explicit bounds and plan deviations

- Transactional JSON aggregate per resource, small immutable acknowledgment receipts; no normalized note/element tables.
- Inline private raster assets with **3 MB resource limit**, rather than separate object storage. Larger-resource support needs further storage/upload work.
- RLS-filtered Postgres Changes plus 1.5-second HTTP catch-up/presence, 12-second expiry; slower cursors than private low-latency broadcast.
- Daily 00:00 UTC/08:00 Taipei cron, at most three due jobs per invocation; manual save invokes worker immediately. Faster capacity needs hosting confirmation.
- Drawing checkpoints require bounded idle previews; oversize previews cannot silently mark backups complete.
- Legacy PIN/password/anonymous behavior preserved but grants no collaboration permission.

## Outstanding live/physical checks

- [ ] Approved Firebase admin credentials, staging Supabase configuration, explicit Google UID roster/admin, dedicated writable Drive destination supplied.
- [ ] Migration, Firebase third-party Auth, role claims and publication applied in approved staging.
- [ ] Real token signature/expired/revoked rejection, editor/editor/viewer sessions, direct asset/RPC denial, membership revocation with open Realtime.
- [ ] Hosted notifications, multiple backend instances, ambiguous acknowledgments and real reconnect latency.
- [ ] Live Drive canonical/images/previews, failed/uncertain retry, external modification/move/delete protection, lease expiry, recovery and scheduler capacity.
- [ ] Native IME, physical mobile/actual-user device and active drag/drawing/image-heavy frame profiling.
- [ ] Remaining dependency advisory review before production rollout.

See [docs/COLLABORATION_HANDOFF.md](docs/COLLABORATION_HANDOFF.md) for exact setup, scope, recovery and evidence limits. An asynchronous question requested a staging location/identifier; none was supplied during this work.

Sandbox exec failed at startup; automatically approved elevated shell fallback and apply_patch were used. Node REPL failed; shell Node worked. Docker engine was stopped, so SQL tests used PGlite. These facts do not establish live infrastructure verification.
