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

Keep the reusable components, SVG icons, themes and motion settings. In 2026-11 the user authorized replacing the original Precision Lab blue palette. A short-lived "Living Lab" look was then refined into a restrained, neutral palette with a single blue accent, solid surfaces with hairline borders, sentence-case labels, and a visible entrance cascade with hover lift that settles within about a second, optimised for low-end devices (no blur, no decorative loops, one mounted page per route). The home tab keeps a "Today's reminders" panel listing the analyst's incubation readings due today or tomorrow, and the hero responds to the mouse with a spotlight and plate parallax. It is presentation only and leaves data, routes and submission logic untouched. Its motion spec is in design/motion.md.

## Evidence on Hand

README.md, design/README.md, design/motion.md, src/design/precision-lab.css, existing components and the approved IMPLEMENTATION_PLAN.md. No verified new live-service behavior yet.

## Accessibility & Inclusion

Keyboard movement, readable note colors, mobile column navigation, reduced motion and fullscreen focus restoration are required. Viewers can read/export and pan/zoom drawings.
