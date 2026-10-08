/** Shared timings in seconds. Operational actions never wait for animation. */
export const motionTiming = { feedback: 0.14, panel: 0.24, introduction: 0.56 };
export const panelTransition = { duration: motionTiming.panel, ease: [0.22, 1, 0.36, 1] as const };
export const reveal = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { ...panelTransition, duration: motionTiming.introduction } },
};
export const stagger = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
