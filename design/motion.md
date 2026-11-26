# Motion specification

| Interaction | Duration | Treatment |
| --- | --- | --- |
| Press, selection, hover feedback | 140ms | Small scale/color feedback; immediate handler execution. |
| Routes, panels, dialogs | 240ms | Opacity and small translations; cubic-bezier(.22, 1, .36, 1). |
| Dashboard introduction | 560ms | Opacity and 16px reveal; 70ms section stagger. |
| Scientific connection/sync orbit | 2.5s loop | Vector rotates while the actual state is active. |
| Submission success | 560ms | SVG check stroke and live success toast after the response. |

## Dashboard and shell (2026-11 refinement)

Visible but cheap, built for low-end hardware (Celeron laptops, budget phones). Tokens live in `src/design/motion.ts`. Springs: `snap` (stiffness 500, damping 35, mass .8) for indicators, with no visible overshoot; `settle` (260/30) for tiles, rows and colonies. CSS curves use cubic-bezier(.22, 1, .36, 1). Only transform and opacity animate (plus box-shadow on hover). No backdrop-filter or blur anywhere, no fixed backgrounds, no shimmer, and no loops other than the sync orbit and spinners while a sync is actually running. Everything settles within about a second; nothing runs while idle.

| Element | Timing | Treatment |
| --- | --- | --- |
| Route change | 240ms | Next page fades in with a 6px rise. No exit phase, so only one page is ever mounted and navigation never waits on animation. |
| Dashboard cascade | settle, 60–70ms stagger | Every visit: hero lines, metric tiles, sample tiles and shortcuts each rise 12px from 98% scale (`revealGroup` / `item`). Entrance sits on a `motion.div` wrapper, never `motion.create(Link)`: Link merges refs per render, which remounts the motion element and freezes it hidden. |
| Colony plate | 0.9s rim, settle colonies | Every visit: rim draws from 12 o'clock, lid highlight fades in, then one colony per recent record grows in (35ms stagger); later records pop in alone. Offline fogs the plate. No scan or sweep. Hidden below 640px. |
| Hero spotlight and parallax (mouse only) | spring 220/28 glow, 90/20 plate | A soft blue radial glow follows the cursor across the hero and fades in/out over 240ms; the plate drifts up to 12px/8px toward the cursor. Springs write transforms through MotionValues, so no React renders; it rests when the pointer leaves. Touch and reduced motion get neither. |
| Connection ping | 1.2s, once | The online dot sends out one ring when the newest record changes (keyed by its id). Not a loop. |
| Today's reminders | settle, 50ms stagger | Always shown. Due rows slide in from -10px; the bell rings once (0.7s) when a reading is due today; the collapse chevron rotates with `snap`. Collapsing lasts until the next day. |
| Metric count-up | 1.12s | MotionValue tween from 0 on every visit; jumps straight to the value under reduced motion. |
| Activity rows | settle, 50ms stagger | Initial rows rise 8px; live arrivals slide down from -12px; others reflow with layout springs. Status badges crossfade. |
| Nav and theme indicators | snap | Shared-layout pill slides between the active items. |
| Hover lift (`hover: hover` only) | 240ms | Metric and shortcut cards rise 2px with a deeper shadow and blue-tinted border; icons turn blue; shortcut arrow nudges 2px up-right; sample graphic scales 1.08; primary button rises 1px with a blue glow; activity rows tint. Uses the standalone `translate`/`scale` properties so it composes with Framer's inline transform. |
| Press | 140ms | Buttons scale to .97, cards to .985. |
| Loading | static | Skeleton rows reuse real row markup so height does not jump; no shimmer. |

Depth is static: a layered card shadow, a 1px top inset highlight, and a single-hue blue wash behind the plate, painted once and never animated.

## State binding

- Dashboard vectors render during introduction; the sync vector replaces the molecule while history refresh is pending.
- Authentication connection loading renders the sync illustration.
- New sample and queue success toasts are triggered by successful submission/retry results, not by a timer.
- Offline connection status and the shared pending queue remain visible; the queue has a static storage illustration.
- Forms and data rows do not have decorative loops. Field-group entry uses the shared panel preset.
- Queue retry preserves sending/failed feedback and never waits for a decorative animation.
- Date and time pickers lock scrolling with `overflow: hidden` on `<html>` and focus with `preventScroll`, so the page never jumps to the top and scrolls back when a picker opens or closes. Do not pin the body with `position: fixed`.

## Accessibility and lifecycle

App-level MotionConfig uses reducedMotion='user'. RouteTransition additionally sets duration to zero when reduced motion is requested. useMotionActivity disables decorative animation when reduced, offscreen, or the document is hidden. CSS prefers-reduced-motion removes animations, transitions and the hover/press translate and scale; document-hidden pauses CSS animation.

The standalone prototype has an explicit Reduce motion control as well as the OS media query. Introduction, connection, sync, saved and offline states can be selected with keyboard-accessible controls. It demonstrates feedback only and performs no lab submissions.

Figma dashboard variants have native OPACITY and TRANSLATION_Y tracks on descendant sections; the full sequence remains within the existing two-second timeline. Linked prototype transitions use 240ms dissolve. The reduced-motion storyboard is static.
