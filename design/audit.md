# Precision Lab audit and workflow inventory

Audit basis: existing source, the deployed dashboard viewed read-only, and isolated previews of all routes. The redesign changes presentation and shared interaction controls. Production records and deployments were not modified.

| Screen / route | Observed usability issues | Controls and workflows retained |
| --- | --- | --- |
| Dashboard / | Oversized introduction, competing actions, history-limited numbers presented without context, inconsistent queue totals, non-actionable activity rows styled as clickable, overlapping reminder panel. | Primary New sample, history refresh, all four sample shortcuts, incubation access, current connection state, reminders, release notes, shared queue count. |
| New sample /new | Inconsistent card hierarchy, small controls, unlabeled fields, decorative form motion. | ENVI, WATER, RawMats/FG/SFG, AIR; query-string preselection; original field groups and validation; custom personnel; bulk submissions; payload/header mapping. |
| Queue /queue | No visible sample identity, icon-only actions without names, weak empty state. AIR retry incorrectly fell through to RawMats. Successful page retries did not retain history metadata. | Durable IndexedDB queue, queued/failed/sending states, Retry All, individual retry/delete, provisional and returned control numbers. Shared reconciliation reads logical or live-header payload fields. |
| History /history | Pointer-only group disclosure, dense rows, modal focus not restored. | Ongoing/completed tabs, analyst/type filters, grouping, pagination, details, record deletion, available reports. Disclosure supports Enter/Space. |
| Live sheet /live | Dense tables, inconsistent toolbar, editor prompt semantics. | Sheet selection, search, sort, column management/freezing, protected editing and password validity, cell edits, pagination. Wide tables scroll inside their container. Mobile cards retain control number and status and support keyboard disclosure. |
| Logbook /logbook | Dense filters and table styling, limited labeling. | Sample-type/analyst filters, grouped records, search, column management, pagination, frozen control number. |
| Reports /results | Unnamed narrow-screen column control, unlabeled search/edit fields, modal keyboard behavior. | Sample tabs, query-string search, sorting/reordering/hiding columns, editing, report generation, pagination. Control and status columns are sticky. |
| Incubation /incubation | Dense priority panels, unnamed results actions. | Due/overdue/upcoming calculations, assumed date, analyst/type filters, copy/send report actions, exact incubation-to-results URLs. External send actions were preserved but not executed. |
| Calendar /calendar | Competing toolbar elements, small date targets, modal dismissal/focus. | Month/week/agenda, Today/Back/Next, analyst filter, day/event details, refresh, Google sync action. |
| Settings /settings | Inconsistent page padding and form hierarchy, weak prompt labels. | Protected configuration, sheet preference, appearance, personnel editor, synchronization, save, clear-data and sign-out actions. |
| Login /login | Weak brand continuity, unnamed password toggle, input labels. | Email/password, PIN, Google sign-in/redirect, access-code and initial setup flows. Authentication logic remains intact. |

## Presentation choices

Inter is retained. The main spacing rhythm is 8px with 16/24/32px containers. Neutral surfaces and blue actions establish the hierarchy; teal denotes scientific and connected states. Semantic states retain text labels and do not depend on color.

Desktop navigation is grouped into Workspace, Lab operations, and Records & reports. Mobile retains bottom navigation, a central New sample action, and a focus-managed menu with every route. Content has bottom clearance; issue reporting is an inline footer action.

Dashboard totals deliberately describe the latest 50 history records. Pending sync uses the count passed from the application's shared queue source. Static activity rows have no interactive styling.

## Figma comparison

The Figma screen page provides 15 layouts (11 routes plus four intake form layouts) in four combinations: light/dark and desktop/mobile. The implementation uses the same hierarchy, themes, actions, and native illustrations. Figma uses synthetic records and simplified editable form/table representations. The running app retains its dynamic schema-dependent tables, original conditional form groups, live reminders, and protected controls; these are not flattened into mockup images.

Figma mobile designs are vertically stacked and scrollable. The app condenses intake cards and rows to fit operational use. Native select controls deliberately use the operating system's picker, which differs from Figma's static input representation.
