import { useEffect, useRef } from 'react';
import { motion, type MotionStyle } from 'framer-motion';
import { motionTiming, panelTransition, spring } from '../../design/motion';
import type { HistoryEntry } from '../../types';

const MAX_COLONIES = 24;
const DAY = 86_400_000;
/** FNV-1a plus a murmur3 finaliser: stable per record, and sequential ids (demo-1, demo-2) still scatter. */
export function hash(text: string, seed = 2166136261) {
  let h = seed;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Deterministic spot inside the agar (radius 62 around 120,90), spread evenly by area. */
export function colonySpot(id: string) {
  const angle = (hash(id) / 2 ** 32) * Math.PI * 2;
  const distance = Math.sqrt(hash(id, 33554467) / 2 ** 32) * 62;
  return { x: 120 + Math.cos(angle) * distance, y: 90 + Math.sin(angle) * distance };
}

/** Older records have grown bigger colonies: 4 px on day zero, 9 px from two weeks on. */
export const colonySize = (submittedAt: string, now: number) => 4 + 5 * Math.min(Math.max((now - Date.parse(submittedAt)) / DAY, 0) || 0, 14) / 14;

/** Decorative agar plate: one static colony per recent record. Meaning stays in the hero text and metrics. */
export default function ColonyPlate({ entries, online, style }: { entries: HistoryEntry[]; online: boolean; style?: MotionStyle }) {
  // The first batch cascades in after the rim draws; later records pop in alone.
  const shown = useRef(false);
  const firstBatch = !shown.current;
  const colonies = entries.slice(0, MAX_COLONIES);
  const now = Date.now();
  useEffect(() => { if (colonies.length) shown.current = true; });
  return (
    <motion.div className="science-graphic lab-hero-art colony-plate" aria-hidden="true" style={style}>
      <svg viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="plate-agar" cx="42%" cy="38%" r="70%">
            <stop offset="0" stopColor="currentColor" stopOpacity=".08" />
            <stop offset="1" stopColor="currentColor" stopOpacity=".02" />
          </radialGradient>
        </defs>
        <motion.circle cx="120" cy="90" r="72" fill="url(#plate-agar)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: motionTiming.introduction }} />
        {/* One-shot rim draw from 12 o'clock, then the lid highlight settles in. */}
        <motion.circle cx="120" cy="90" r="72" transform="rotate(-90 120 90)" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: panelTransition.ease }} />
        <circle cx="120" cy="90" r="67" stroke="currentColor" strokeOpacity=".12" />
        <motion.path d="M74 47a64 64 0 0 1 60-19" stroke="currentColor" strokeOpacity=".22" strokeWidth="2.5" strokeLinecap="round"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: motionTiming.introduction }} />
        {colonies.map((entry, index) => {
          const { x, y } = colonySpot(entry.id);
          const r = colonySize(entry.submittedAt, now);
          return (
            <motion.g key={entry.id} className={`colony ${entry.sampleType.toLowerCase()}`} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ ...spring.settle, delay: firstBatch ? 0.35 + index * 0.035 : 0 }}>
              <circle cx={x} cy={y} r={r + 3} fill="currentColor" fillOpacity=".14" />
              <circle cx={x} cy={y} r={r} fill="currentColor" fillOpacity=".8" />
            </motion.g>
          );
        })}
        <motion.circle className="plate-fog" cx="120" cy="90" r="76" initial={false} animate={{ opacity: online ? 0 : 0.55 }} transition={{ duration: motionTiming.introduction }} />
      </svg>
    </motion.div>
  );
}
