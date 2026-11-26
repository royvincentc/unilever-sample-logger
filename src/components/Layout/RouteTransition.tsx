import type { ReactNode } from 'react';
import { useLocation, type Location } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { panelTransition } from '../../design/motion';

/**
 * Fades the next route in without an exit phase, so only one page is ever mounted and
 * navigation never waits on animation (cheap on low-end CPUs).
 */
export default function RouteTransition({ children }: { children: (location: Location) => ReactNode }) {
  const location = useLocation();
  const reduced = useReducedMotion();
  return (
    <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={reduced ? { duration: 0 } : panelTransition}>
      {children(location)}
    </motion.div>
  );
}
