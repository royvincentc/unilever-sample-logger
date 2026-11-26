/** Shared timings in seconds. Operational actions never wait for animation. */
export const motionTiming = { feedback: 0.14, panel: 0.24, introduction: 0.56 };
export const panelTransition = { duration: motionTiming.panel, ease: [0.22, 1, 0.36, 1] as const };
/** Springs: `snap` for indicators and presses (no visible overshoot), `settle` for panels and pages. */
export const spring = {
  snap: { type: 'spring', stiffness: 500, damping: 35, mass: 0.8 },
  settle: { type: 'spring', stiffness: 260, damping: 30 },
} as const;
export const reveal = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { ...panelTransition, duration: motionTiming.introduction } },
};
export const stagger = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
/** A card that reveals itself, then cascades its `item` children in. */
export const revealGroup = {
  hidden: reveal.hidden,
  show: { ...reveal.show, transition: { ...reveal.show.transition, delayChildren: 0.08, staggerChildren: 0.06 } },
};
/** One tile or line inside a cascading group. */
export const item = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring.settle },
};
