# Collaboration design documentation

Date: 2026-10-10. Scope: ordinary code-led extension of Precision Lab for shared Kanban notes and drawings. Review disposition: **ship**, at the screenshot and source scope recorded in [collaboration-design-review.md](collaboration-design-review.md).

## Authority and persistence

[PRODUCT.md](../../PRODUCT.md) requires preserving the incumbent identity, components, SVG icons, themes and motion settings. [design/README.md](../README.md), [precision-lab.css](../../src/design/precision-lab.css), [motion.md](../motion.md) and existing components remain the design authority. `src/main.tsx` imports the base stylesheet followed by Precision Lab. The collaboration stylesheet is an extension imported by the new surfaces.

There is no root DESIGN.md. No direction brief, five-block direction contract, QUALITY BAR card or approved comp was persisted or supplied to this pass. This is an evidence gap, not evidence of a new visual-world choice. No new metaphor, seed, user-approved world or visual system replacement is inferred. Under new-work's ordinary-extension documentation rule, this record compares the finished work to the incumbent system; it does not generate a replacement DESIGN.md or `.impeccable/design.json`. Incumbent design files were preserved.

## Finished extension against the incumbent system

| Dimension | Incumbent authority | Finished extension and evidence |
| --- | --- | --- |
| Ground and palette | Cool light ground, white surfaces, navy text, blue actions, teal status; corresponding dark semantic variables | Board screenshots retain the light ground and navy hierarchy; narrow-dark retains the dark shell. Collaboration styles use semantic surface, text, border and accent variables. |
| Typography | Inter/system sans in index.css; Precision Lab operational headings generally use weight 650 | Resource headings use weight 650, 28px desktop and 24px below 700px; note and form bodies use 14px. Resource heading, smaller state row and column titles form the visible hierarchy. |
| Shape and depth | Rounded controls and panels, subtle borders and small shadows | Controls use 8px corners, notes 10px, panels/columns/canvas 12px, dialogs 14px. Notes have a restrained shadow; the drag overlay has stronger lift. These are local component values, not a replacement token scale. |
| Controls and icons | Shared Button primitive, lab-button variants, SVG icons, 44px controls | Workspace sign-in and resource creation reuse Button; secondary management controls reuse lab-button. Lucide SVG controls carry settings, trash, movement and fullscreen actions. Local button minima are 44px in each dimension. |
| Focus and motion | Blue visible focus, 140ms feedback, reduced-motion support | Collaboration defines a 2px blue focus outline with 3px offset; whiteboard-desktop visibly shows focus on Fullscreen. Save feedback and drop animation use 140ms; reduced motion removes local animation/transitions and smooth scrolling, disables drop animation, and disables animated fit-to-content. |
| Status hierarchy | Truthful operational state feedback | Connection, pending operations, backend revision and Drive status are separate readable spans. Captures explicitly show Drive not configured; that state is not presented as successful Drive saving. |
| Desktop layout | Bounded working areas, operational density, responsive shell | Collaboration page maximum is 1800px with 24px/32px padding. Horizontal 300px columns and 20px gaps leave a calm working field. Inspector is 300px, reduced to 260px below 1100px. These are task-specific adaptations. |
| Mobile layout | Responsive spacing and accessible controls | Below 700px page padding becomes 20px/16px, columns 280px, selector occupies available width, and inspector moves above the board. Toolbar stacks below 1100px. Captures show wrapped actions and readable selected Done column at 390px and 320px. |
| Drawing surface | Preserve app chrome while integrating the official editor | Official Excalidraw controls and its own canvas styling remain within a bordered app frame. Its white initial canvas is drawing content, not a new app theme. Viewer mode retains integration export/fullscreen actions and removes editor tools in the supplied mobile state. |

### Local component patterns

The resource library uses a heading/action row, inline creation form, divided resource rows and restrained empty/access states. The editor leads with resource name, resource actions and the save-status row. Amber error/conflict panels distinguish actionable feedback. These patterns are supported by source inspection; resource-library, access/error and conflict screenshots were not supplied.

Kanban notes use four explicit pastel/background and dark-text pairs: yellow `#fff0b3` / `#4b3b0a`, blue `#dceaff` / `#1e3a65`, green `#dcf2e4` / `#1d4932`, pink `#fae0e9` / `#633047`. These note colors remain stable in the dark board screenshot while the shell changes theme. They are local note classifications, not additions to the incumbent global palette. Header activation, inline body editing, settings inspector and movement/recovery controls are implemented in source; still captures cannot establish their synchronization or keyboard behavior.

The drawing frame uses a fixed working height of max(550px, 70vh), changing to 75vh below 700px. The integration toolbar wraps. Fullscreen has a viewport-sized fixed frame with zero radius; fit/export/fullscreen remain available to viewers. Excalidraw's scene and native controls retain their own visual vocabulary rather than being re-skinned as lab form controls.

## Evidence checked

All six supplied captures were opened in this documentation pass. The existing reviewer also validated their capture regions and page tops.

| Capture | Documented state and useful evidence |
| --- | --- |
| [desktop.png](../../.impeccable/review/desktop.png) | 1440px board: resource title, horizontal actions, four separate statuses, three columns, colored notes and participant text. |
| [mobile.png](../../.impeccable/review/mobile.png) | 390px board: wrapped actions/statuses, full-width column selector, readable Done notes and neighboring-column sliver. |
| [user-1036.png](../../.impeccable/review/user-1036.png) | 1036px full-page capture from reported 1036x578 viewport: stacked toolbar and three-column board. Full-page height does not imply every note fits simultaneously within the viewport. |
| [narrow-dark.png](../../.impeccable/review/narrow-dark.png) | 320px dark board: inherited shell heading reflows, action/status rows wrap, selected column and pastel note text remain visible. |
| [whiteboard-desktop.png](../../.impeccable/review/whiteboard-desktop.png) | 1440px editor-history spike: official editor tools, two drawn shapes, zoom/history controls, integration toolbar and visible focus. This isolated spike does not show the complete resource-editor shell. |
| [whiteboard-mobile.png](../../.impeccable/review/whiteboard-mobile.png) | 390px initially empty viewer drawing: full app heading/status shell and wrapped fit/export/fullscreen controls. Empty scene is fixture content; this capture does not demonstrate a populated mobile drawing. |

Source evidence checked: collaboration WorkspaceGate, ResourceList, ResourceEditor, SaveStatus and ConflictReview; KanbanBoard; ExcalidrawEditor; collaboration.css; incumbent precision-lab.css, index.css, main.tsx and shared Button; PRODUCT.md, incumbent README/motion documentation and the finish-review report.

This documentation pass performed no browser interaction, computed-style/contrast measurement, animation observation or live backend/Drive verification. It does not independently certify drag/drop, concurrent editing, deletion recovery, fullscreen focus restoration or offline retry. Those functional checks belong to the implementation handoff. Open inspector, conflict/error, deletion-dialog, drag-overlay and fullscreen captures were not supplied, so their rendered finish remains outside the screenshot verdict.

## Pre-existing drift and preservation

The incumbent stylesheet has accumulated overlapping rules: index.css still defines earlier Oceanic/neon tokens and broader radii, while precision-lab.css overrides semantic colors and selected primary/accent values. Precision Lab also has later readability and touch-target overrides. This is existing source layering; the new extension draws from the current semantic variables and shared components. No token consolidation or cleanup was performed.

Precision Lab's initial flat-ground/no-background-image rules coexist with later navy gradient overrides for dark shell, sidebar, header, panels, hero and primary buttons. The narrow dark capture reflects that incumbent evolution. The extension's dark appearance should be read against the final incumbent cascade, not a claim that the older flat-only description remains universal. No gradient removal or redesign was performed.

The shared shell's very small workspace eyebrow is inherited typography (and wraps at 320px). It remains an incumbent characteristic under the preservation instruction rather than being converted into a new type system. These observations document existing drift; they do not expand the reviewer's material-fix list.

## Outcome and continuing guidance

The supplied source and six captures support continuity with Precision Lab for the reviewed board and editor/viewer states. The reviewer issued ship with no material fixes at that scope. Keep semantic theme variables, shared Button/lab-button primitives, SVG controls, separate save states, mobile column navigation, local pastel note pairs, official Excalidraw controls and reduced-motion behavior when extending this work. Future implementation changes require rechecking this evidence; this record does not establish new global design authority.
