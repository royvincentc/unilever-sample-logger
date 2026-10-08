import { useMotionActivity } from '../../hooks/useMotionActivity';

export type ScienceKind = 'envi' | 'water' | 'rawmats' | 'air' | 'incubation' | 'offline' | 'sync' | 'success' | 'empty' | 'molecule';

export default function ScienceGraphic({ kind = 'molecule', animated = false, className = '' }: {
  kind?: ScienceKind; animated?: boolean; className?: string;
}) {
  const { ref, active } = useMotionActivity(animated);
  return (
    <div ref={ref} className={`science-graphic ${active ? 'science-active' : ''} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="120" cy="90" r="74" stroke="currentColor" strokeOpacity=".12" strokeDasharray="3 8" />
        <circle cx="120" cy="90" r="52" stroke="currentColor" strokeOpacity=".09" />
        {kind === 'molecule' ? <>
          <path className="science-path" d="M40 105L82 52L140 68L194 40M82 52L103 127L171 139L140 68M103 127L40 105M171 139L211 102L140 68" stroke="currentColor" strokeWidth="2" />
          {[ [40,105], [82,52], [140,68], [194,40], [103,127], [171,139], [211,102] ].map(([x,y],i) => <g key={i} className="science-node" style={{ animationDelay: `${i * .18}s` }}><circle cx={x} cy={y} r={i === 2 ? 13 : 8} fill="var(--bg-card)" stroke="currentColor" strokeWidth="2" /><circle cx={x} cy={y} r="3" fill="currentColor" /></g>)}
        </> : <>
          <circle cx="120" cy="90" r="47" fill="currentColor" fillOpacity=".06" />
          {kind === 'water' && <path className="science-float" d="M120 48C112 65 94 83 94 100a26 26 0 0052 0c0-17-18-35-26-52zM104 103c0 9 6 15 15 15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />}
          {(kind === 'envi' || kind === 'empty' || kind === 'incubation') && <><path d="M106 48h28M110 49v35l-22 36a9 9 0 008 14h48a9 9 0 008-14l-22-36V49" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><path className="science-path" d="M102 108c10-8 26 8 36 0M98 119h43" stroke="currentColor" strokeWidth="2" /><circle className="science-bubble" cx="117" cy="97" r="3" fill="currentColor" /><circle className="science-bubble" cx="129" cy="118" r="2" fill="currentColor" />{kind === 'incubation' && <><circle cx="157" cy="63" r="18" fill="var(--bg-card)" stroke="currentColor" strokeWidth="2" /><path d="M157 51v12l8 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}</>}
          {kind === 'rawmats' && <path className="science-float" d="M88 74l32-18 32 18v40l-32 18-32-18V74zm0 0l32 18 32-18m-32 18v40m-17-67l33 18" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />}
          {kind === 'air' && <path className="science-path" d="M84 80h56c22 0 20-28 3-24-5 1-8 5-8 9M78 94h78M87 108h43c22 0 20 28 3 24-5-1-8-5-8-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />}
          {kind === 'offline' && <><path d="M91 107h60c20 0 24-29 4-35-4-30-46-31-53-4-29-6-35 36-11 39z" stroke="currentColor" strokeWidth="3" /><path d="M109 117v17h22v-17m-11 0V90m-9 9l9-9 9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></>}
          {kind === 'sync' && <g className="science-orbit"><path d="M151 78a34 34 0 00-57-13l-10 11m0 0V55m0 21h21M89 102a34 34 0 0057 13l10-11m0 0v21m0-21h-21" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></g>}
          {kind === 'success' && <><circle cx="120" cy="90" r="34" stroke="currentColor" strokeWidth="3" /><path className="science-check" d="M103 91l12 12 24-25" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></>}
        </>}
        <path d="M22 32h8m-4-4v8M204 144h8m-4-4v8" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" />
      </svg>
    </div>
  );
}
