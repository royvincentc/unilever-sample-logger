# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

QC microbiology laboratory staff logging samples and coordinating shared laboratory work. Repository README identifies a Unilever laboratory in the Philippines.

## Product Purpose

Preserve mobile/offline sample logging while adding shared Kanban notes and drawings. The approved feature plan requires collaborative editing, viewer access, recoverable deletion and Drive checkpoints.

## Capabilities and Constraints

Existing React/Vite SPA on Vercel. Collaboration uses verified Firebase Google identities and explicit server-managed memberships; approved defaults specify a single QC workspace with admin/editor/viewer roles. Provisioned identities, credentials and Drive destination remain open operational inputs. No automatic Drive sharing changes.

## Brand Commitments

Preserve the incumbent Precision Lab identity, reusable components, SVG icons, themes and motion settings, as explicitly required by the user.

## Evidence on Hand

README.md, design/README.md, design/motion.md, src/design/precision-lab.css, existing components and the approved IMPLEMENTATION_PLAN.md. No verified new live-service behavior yet.

## Accessibility & Inclusion

Keyboard movement, readable note colors, mobile column navigation, reduced motion and fullscreen focus restoration are required. Viewers can read/export and pan/zoom drawings.
