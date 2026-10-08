import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/** Scientific loops run only while visible, in view, and motion is permitted. */
export function useMotionActivity(enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  return { ref, active: enabled && !reduced && visible && inView };
}
