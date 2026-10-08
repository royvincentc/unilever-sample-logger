# UL Sample Logger · Precision Lab

The implemented redesign preserves existing routes, API endpoints, storage version, authentication, submission mapping, and export code. There is no backend migration or deployment.

## Deliverables

- [Editable Figma file](https://www.figma.com/design/fuHgAhiqMDRPZIFFWXSC6D): foundations, components, 60 screen layouts, light/dark interaction states, native introduction keyframes, and linked navigation/submission/sync flows.
- [Desktop concept](concepts/desktop.png), [mobile concept](concepts/mobile.png), and [motion storyboard](concepts/motion-storyboard.png).
- [Generation prompts](concepts/prompts.md). Raster concepts are references; app controls are real components.
- Ten editable [SVG illustrations](vectors): ENVI, water, raw materials, air, incubation, offline, sync, success, empty, molecule. The React equivalents live in src/components/ui/ScienceGraphic.tsx.
- [Interactive motion study](motion-prototype.html). Serve the project and open /design/motion-prototype.html; it uses only synthetic data and local SVGs.
- [Audit and workflow inventory](audit.md), [motion specification](motion.md), and [validation report](validation/README.md).
- [Desktop implementation screenshot](validation/dashboard-desktop.jpg) and [dark mobile screenshot](validation/dashboard-mobile-dark.jpg).

## Review locally

Use Node directly if the host's npm launcher fails:

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174
node node_modules/vite/bin/vite.js --config tools/design-preview/preview.config.ts
```

The first server runs the regular app and serves the standalone motion study. The second is a synthetic-only preview at http://127.0.0.1:5190. It renders the actual pages and uses a dedicated fixture entry/config to replace remote services. Its toolbar can simulate connection loss; IndexedDB remains real but is isolated by localhost origin. Do not use this fixture entry as a production entry point.

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
node tools/design-preview/regression.cjs
node tools/design-preview/contrast.cjs
```

The Figma JavaScript files are authoring excerpts. The live Figma file includes subsequent layout repairs, contrast corrections, and linked state frames; rerunning these excerpts alone does not recreate every later refinement.

## Implementation map

Shared styling is in src/design/precision-lab.css. Motion constants are in src/design/motion.ts. Visibility-aware scientific loops are handled by useMotionActivity, and dialog focus/Escape restoration by useDialogFocus.

The two operational corrections found during verification are AIR queue endpoint selection and queued-history reconciliation. historyFromQueuedSample reads the existing live-header resolver, accepts returned control numbers, rejects placeholder expressions/N/A, and retains sample metadata.
