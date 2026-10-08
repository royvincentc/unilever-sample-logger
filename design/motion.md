# Motion specification

| Interaction | Duration | Treatment |
| --- | --- | --- |
| Press, selection, hover feedback | 140ms | Small scale/color feedback; immediate handler execution. |
| Routes, panels, dialogs | 240ms | Opacity and small translations; cubic-bezier(.22, 1, .36, 1). |
| Dashboard introduction | 560ms | Opacity and 16px reveal; 70ms section stagger. |
| Scientific connection/sync orbit | 2.5s loop | Vector rotates while the actual state is active. |
| Scientific nodes/droplets | 3s loop | Gentle opacity or 4px float in decorative areas. |
| Submission success | 560ms | SVG check stroke and live success toast after the response. |

## State binding

- Dashboard vectors render during introduction; the sync vector replaces the molecule while history refresh is pending.
- Authentication connection loading renders the sync illustration.
- New sample and queue success toasts are triggered by successful submission/retry results, not by a timer.
- Offline connection status and the shared pending queue remain visible; the queue has a static storage illustration.
- Forms and data rows do not have decorative loops. Field-group entry uses the shared panel preset.
- Queue retry preserves sending/failed feedback and never waits for a decorative animation.

## Accessibility and lifecycle

App-level MotionConfig uses reducedMotion='user'. PageTransition additionally sets duration to zero when reduced motion is requested. useMotionActivity disables decorative animation when reduced, offscreen, or the document is hidden. CSS prefers-reduced-motion removes animations and transitions; document-hidden pauses CSS animation.

The standalone prototype has an explicit Reduce motion control as well as the OS media query. Introduction, connection, sync, saved and offline states can be selected with keyboard-accessible controls. It demonstrates feedback only and performs no lab submissions.

Figma dashboard variants have native OPACITY and TRANSLATION_Y tracks on descendant sections; the full sequence remains within the existing two-second timeline. Linked prototype transitions use 240ms dissolve. The reduced-motion storyboard is static.
