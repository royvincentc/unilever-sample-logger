import ScienceGraphic from './ScienceGraphic';
import type { ScienceKind } from './ScienceGraphic';
export default function PageIntro({ title, description, kind = 'molecule' }: { title: string; description: string; kind?: ScienceKind }) {
  return <section className="lab-intro"><ScienceGraphic kind={kind} /><div><h1>{title}</h1><p>{description}</p></div></section>;
}
