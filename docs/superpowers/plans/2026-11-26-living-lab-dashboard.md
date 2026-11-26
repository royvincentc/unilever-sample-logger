# Living Lab — Dashboard + shell redesign plan

**Decisions (2026-11-26):** scope is the Dashboard (`/`) and the app shell (sidebar, header, bottom nav, mobile drawer, route transitions). Direction is "Living Lab". All animation is code-driven (SVG + Framer Motion), with no video files. Precision Lab stays (Inter, blue/teal, existing icons and illustrations) but gets refined. Other pages keep their layouts. They pick up only the new shell and transitions.

**Hard rule: presentation only.** No changes to data hooks, routes, API calls, IndexedDB, auth, or submission logic. Every behaviour in the contract below must still work after each slice.

## Functionality contract (must survive every slice)

Dashboard (`src/pages/Dashboard.tsx`)
- `getHistory(50)` initial load + `listenToHistory` live subscription re-bound on `auth.onAuthStateChanged`; cleanup on unmount.
- Sync records: disabled offline or while syncing, `aria-busy`, success/info/error toasts, reload after sync.
- New sample link; `ShiftSummaryModal`; `PatchNotesModal`; `NotificationPopup` reminders.
- Connection status (`role="status"`) and `N pending sync` link to `/queue`.
- Four metrics. Values come from the latest 50 records plus `queueCount`, each links to its page, and each shows `—` while loading.
- Recent activity shows 6 rows and has error (retry), loading, and empty (CTA) states.
- Quick intake links `/new?type=ENVI|WATER|RawMats|AIR`, incubation link, four shortcuts.
- Header theme switch (light/dark/system, `aria-pressed`), network indicator.

Shell (`src/components/Layout/*`)
- Skip link, offline banner, report-issue modal.
- Sidebar: four groups and every route, collapse toggle (desktop), queue badge, sign out.
- Mobile drawer: focus trap + Escape via `useDialogFocus`, body scroll lock, `inert` on background, backdrop click closes.
- Bottom nav: Home/History/New sample/Queue/Menu, queue badge, `end` match on `/`.

Accessibility and motion rules (already in `design/motion.md`, keep them)
- `MotionConfig reducedMotion="user"` + CSS `prefers-reduced-motion`; decorative loops gated by `useMotionActivity` (hidden tab / offscreen / reduced → paused).
- Operational actions never wait for an animation.

## Motion system (slice 1 foundation)

Extend `src/design/motion.ts` and do not replace it. The existing timings stay.
- Add two spring presets. `snap` (stiffness ~500, damping ~35) handles presses, indicators and badges. `settle` (~260 / 30) handles panels and cards.
- Animate only `transform`, `opacity`, `clip-path`. Never width/height/top/left.
- Numbers animate through motion values (`animate()` on a `MotionValue` rendered with `<motion.span>`), so there is no React re-render per frame.
- Run the first-visit intro choreography once per session (`sessionStorage`). Later visits to `/` get only a fast 240 ms settle.

## Slices (one PR each, each shippable on its own)

### 1. Shell + transitions
- **Route transitions:** the current `AnimatePresence mode="wait"` makes every navigation wait 240 ms for the exit and then 240 ms for the enter. Replace it with a quick enter (opacity + 8 px rise) and no exit wait, so navigation feels instant.
- **Spike (timeboxed):** React Router's built-in `<Link viewTransition>` with View Transitions CSS for the morph from card to page. Where the browser doesn't support it, navigation is simply instant. Adopt it only if it works together with the Framer route transition. Otherwise drop it.
- Sidebar: the active-item highlight slides between items on a spring (`layoutId`), the collapse width animates with a transform-based approach, and the group labels fade.
- Mobile drawer: spring slide-in and backdrop fade. The drawer currently pops in with no animation. It stays mounted through exit via `AnimatePresence`, and focus restoration is kept.
- Bottom nav: the active indicator morphs between tabs, the New sample button gets press feedback, and the queue badge pops when the count changes.
- Header: a sliding pill on the theme switch, plus a soft pulse on the network dot when its state changes.

### 2. Living plate hero
- New `src/components/dashboard/ColonyPlate.tsx` is an SVG agar plate. Each of the recent records (cap 24) is a colony.
  - Position is a deterministic hash of the entry id, so colonies stay in place across renders. Colour comes from the sample type (existing tone tokens), and size grows with age.
  - `ONGOING` colonies breathe slowly. Completed ones sit still.
  - A record arriving through the live listener grows in with a spring. This is the "a sample just landed" moment.
  - While syncing, a sweep ring rotates around the plate. Offline, the plate desaturates and a fog layer appears.
  - The SVG is decorative (`aria-hidden`), and the existing text and metrics carry the meaning. Reduced motion gets a static plate.
- It replaces the molecule `ScienceGraphic` in the hero. The sync and offline states keep their current meaning.
- Hero copy gets a time-of-day greeting with the first name and a tighter type scale.

### 3. Metrics + activity
- Metric cards: numbers count up from 0 on the first intro and tween from the old to the new value afterwards. Cards lift on hover, scale slightly on press, and tone-coloured glow edges follow the pointer (CSS custom properties, no re-render).
- Activity list: rows stagger in, and a new record slides in at the top with `layout` animation while the others shift down. A status change crossfades the badge.
- Loading: skeleton shimmer rows replace the spinner graphic, and the layout doesn't jump when data arrives.

### 4. Quick intake + polish
- Sample tiles get hover/focus micro-animations on their existing illustrations: an ENVI swab stroke, a falling water droplet, a material box lid, and drifting air lines. They are gated by `useMotionActivity`.
- Shortcuts get a magnetic hover offset (pointer devices only, `@media (hover: hover)`).
- Final pass on spacing, depth (layered shadows, subtle surface gradients), and dark-mode contrast.
- Update `design/motion.md` and `PRODUCT.md` to record the new motion spec.

## Performance budget
- No new dependencies. Framer Motion 12 and React Router's `viewTransition` are already installed.
- Bundle growth under 10 KB gzip for all slices combined.
- 60 fps on a Chrome performance trace with 4× CPU throttle at 375 px. No long tasks over 50 ms caused by animation.
- At most 24 animated colonies. All loops pause when offscreen or when the tab is hidden.

## Verification (every slice)
1. `tsc --noEmit` + `vite build`.
2. `npm test` (unit) + `node tools/design-preview/regression.cjs` + `node tools/design-preview/contrast.cjs`.
3. **New:** `tests/e2e/dashboard-shell.spec.ts`, a Playwright smoke test against the synthetic preview (`tools/design-preview`). It checks that every metric, shortcut and intake link navigates, sync is disabled offline, drawer focus trap and Escape work, the queue badge appears, the theme switch works, and axe reports no violations. It gets written **before** slice 1, against the current UI, so any regression shows up.
4. Real browser at 1440 px and 375 px, light and dark, with reduced motion on and off, and keyboard-only navigation through the shell.
5. Offline toggle in the preview harness: plate fog, disabled sync, pending-sync link.

## Risks
- View Transitions combined with Framer route transitions may conflict. The spike decides, with a clean fallback.
- Low-end Android phones on the lab floor. The throttled trace and the colony cap guard against this.
- Visual-only changes can still break selectors, so the smoke test comes first.
