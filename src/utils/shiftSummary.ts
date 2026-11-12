export type Shift = 'AM' | 'PM';
export type ShiftRows = Partial<Record<'ENVI' | 'WATER' | 'RawMats', Record<string, unknown>[]>>;

const OFFSET = 8 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const labDate = (date: Date) => new Date(date.getTime() + OFFSET).toISOString().slice(0, 10);

function validDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function getShiftWindow(date: string, shift: Shift): { start: Date; end: Date } {
  if (!validDate(date) || !['AM', 'PM'].includes(shift)) throw new Error('Choose a valid shift date and shift.');
  const start = new Date(`${date}T${shift === 'AM' ? '06' : '18'}:00:00+08:00`);
  return { start, end: new Date(start.getTime() + DAY / 2) };
}

export function getDefaultShift(now = new Date()): { date: string; shift: Shift } {
  const hour = new Date(now.getTime() + OFFSET).getUTCHours();
  return { date: labDate(new Date(now.getTime() - (hour < 6 ? DAY : 0))), shift: hour >= 6 && hour < 18 ? 'AM' : 'PM' };
}

const normalize = (key: string) => key.trim().toUpperCase().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/');
function cell(row: Record<string, unknown>, ...names: string[]): string {
  for (const name of names) {
    const text = String(row[normalize(name)] ?? '').trim();
    if (text && !/^(?:-|n\/a|null|undefined)$/i.test(text)) return text;
  }
  return '';
}

function sheetDate(value: string): string | null {
  let date = value;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) date = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  return validDate(date) ? date : null;
}

function sheetTime(value: string): number | null {
  const match = value.replace(/\s+/g, ' ').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]), second = Number(match[3] || 0);
  if (minute > 59 || second > 59 || (match[4] ? hour < 1 || hour > 12 : hour > 23)) return null;
  if (match[4]) hour = hour % 12 + (match[4].toUpperCase() === 'PM' ? 12 : 0);
  return hour * 3600 + minute * 60 + second;
}

function swabEquipment(name: string): string {
  const equipment = name.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^PMI\b/i, 'PM1');
  if (/^(?:LEEPACK|LEEPAK|LEEPAC|LEPACK)\b/i.test(equipment)) return 'Leepack';
  const akash = equipment.match(/^AKASH\s*0*(\d+)\b/i);
  if (akash) return `Akash ${akash[1]}`;
  const tank = equipment.match(/^(?:STORAGE\s*TANK\s*|ST\s*)0*(\d+)\b/i);
  if (tank) return `ST${tank[1]}`;
  const sidePot = equipment.match(/^(?:SIDE\s*POT\s*|SP\s*)0*(\d+)\b/i);
  if (sidePot) return `SP${sidePot[1]}`;
  const premix = equipment.match(/^(?:PRE\s*MIX(?:ING)?\s*(?:TANK\s*)?|PM\s*)0*(\d+)\b/i);
  if (premix) return `PM${premix[1]}`;
  const mixing = equipment.match(/^(?:MAIN\s*MIXING\s*TANK\s*|MX\s*)0*(\d+)\b/i);
  // shortcut: unfamiliar equipment stays verbatim; add aliases when a new family is confirmed.
  return mixing ? `MX${mixing[1].padStart(2, '0')}` : name;
}

interface Activity {
  label: string;
  person: string;
  timestamp: number;
  handover: boolean;
}

function groupedLines(activities: Activity[]): string[] {
  const people = new Map<string, { name: string; labels: string[] }>();
  for (const activity of activities.sort((a, b) => a.timestamp - b.timestamp)) {
    const key = activity.person.toUpperCase();
    if (!people.has(key)) people.set(key, { name: activity.person, labels: [] });
    people.get(key)!.labels.push(activity.label);
  }
  const outgoing = activities.every(activity => activity.handover);
  return [...people.values()].flatMap(({ name, labels }) => [
    ...labels, ...(outgoing && name === 'Unspecified' ? [] : [`\u2014 ${name} \u2014`]), '',
  ]);
}

export function generateShiftSummary(
  rows: ShiftRows, date: string, shift: Shift, now = new Date(),
): { text: string; warnings: string[]; count: number } {
  const { start, end } = getShiftWindow(date, shift);
  const handoverPeriod = 3 * 60 * 60 * 1000;
  const incomingStart = start.getTime() - handoverPeriod;
  const overtimeEnd = Math.min(now.getTime(), start.getTime() + DAY - 1);
  const firstDay = labDate(new Date(incomingStart)), lastDay = labDate(new Date(Math.max(end.getTime() - 1, overtimeEnd)));
  const hour = new Date(now.getTime() + OFFSET).getUTCHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const [year, month, day] = date.split('-');
  const lines = [`${greeting}!`, '', `${month}/${day}/${year}`, ''];
  const warnings: string[] = [];
  const sections: { title: string; activities: Activity[] }[] = [];
  let count = 0;
  for (const type of ['ENVI', 'WATER', 'RawMats'] as const) {
    const title = type === 'RawMats' ? 'RM,FG,SFG' : type === 'WATER' ? 'Water' : 'ENVI';
    const activities: Activity[] = [];
    const swabGroups = new Map<string, { activity: Activity; names: Map<string, string> }>();
    const materialGroups = new Map<string, { activity: Activity; name: string; source: string }[]>();
    let invalid = 0;
    for (const raw of rows[type] || []) {
      const row = Object.fromEntries(Object.entries(raw).map(([key, value]) => [normalize(key), value]));
      const dateValue = type === 'ENVI'
        ? cell(row, 'DATE SWABBED', 'DATE SAMPLED', 'DATE RECEIVED/SAMPLED', 'DATE RECEIVED', 'DATE')
        : type === 'WATER'
          ? cell(row, 'DATE SAMPLED', 'DATE COLLECTED', 'DATE RECEIVED/SAMPLED', 'DATE RECEIVED', 'DATE')
          : cell(row, 'DATE RECEIVED/SAMPLED', 'DATE RECEIVED', 'DATE SAMPLED', 'DATE');
      const parsedDate = sheetDate(dateValue);
      if (!parsedDate) { invalid++; continue; }
      if (parsedDate < firstDay || parsedDate > lastDay) continue;
      const timeValue = type === 'ENVI'
        ? cell(row, 'TIME SWABBED', 'TIME SAMPLED', 'SWAB TIME', 'TIME')
        : type === 'WATER'
          ? cell(row, 'TIME SAMPLED', 'TIME COLLECTED', 'TIME')
          : cell(row, 'TIME RECEIVED', 'TIME RECEIVED/SAMPLED', 'TIME SAMPLED', 'TIME');
      const seconds = sheetTime(timeValue);
      if (seconds === null) { invalid++; continue; }
      const timestamp = new Date(`${parsedDate}T00:00:00+08:00`).getTime() + seconds * 1000;
      if (timestamp < incomingStart) continue;
      if (timestamp >= end.getTime()
        && (timestamp > overtimeEnd || cell(row, 'ANALYZED BY', 'PERFORMED BY'))) continue;
      const incoming = timestamp < start.getTime();
      const name = type === 'WATER'
        ? cell(row, 'WATER SOURCE', 'SAMPLING POINT', 'SAMPLE', 'SAMPLE NAME')
        : cell(row, 'SAMPLE', 'SAMPLE NAME', 'SAMPLE DESCRIPTION', 'SAMPLING POINT');
      const batch = type === 'RawMats' ? cell(row, 'MIXING BATCH #', 'BATCH #', 'BATCH NO', 'BATCH NO.', 'CUC #', 'CUC NO', 'CUC') : '';
      const person = (type === 'RawMats' ? cell(row, 'ANALYZED BY', 'RECEIVED BY')
        : cell(row, 'ANALYZED BY')) || 'Unspecified';
      const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds / 60) % 60;
      const time = `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
      const endorsedTo = cell(row, 'ENDORSED TO', 'ENDORSED', 'ENDORSE');
      const remarks = cell(row, 'REMARKS', 'COMMENTS', 'NOTES');
      const endorsement = [endorsedTo ? `Endorsed to ${endorsedTo}` : '', remarks].filter(Boolean).join('; ');
      const target = endorsement.match(/\bendorse(?:d)?\s+to\s+(?:the\s+)?(day\s*shift|night\s*shift|AM\s*shift|PM\s*shift)\b/i)?.[1].replace(/\s/g, '').toUpperCase();
      const explicitHandover = shift === 'AM' ? target === 'NIGHTSHIFT' || target === 'PMSHIFT' : target === 'DAYSHIFT' || target === 'AMSHIFT';
      const handover = !incoming && (timestamp >= end.getTime() - handoverPeriod || explicitHandover);
      const notes = [endorsement, incoming ? `Endorsed by ${shift === 'AM' ? 'Night Shift' : 'Dayshift'}` : ''].filter(Boolean).join('; ');
      const displayName = type === 'ENVI' ? swabEquipment(name) : type === 'RawMats'
        ? name.replace(/^Surf\s+Liquid\s+Detergent\b/i, 'SLD').replace(/^Surf\s+Fabric\s+Conditioner\b/i, 'SFC')
        : name;
      const sampleName = displayName || (type === 'ENVI' ? '' : cell(row, 'CONTROL #', 'CONTROL NUMBER')) || 'Unnamed sample';
      const label = `${sampleName}${batch ? ` : ${batch}` : ''} @ ${time}${notes ? ` (${notes})` : ''}`;
      count++;
      const activity = { label, person, timestamp, handover };
      if (type === 'ENVI') {
        const control = cell(row, 'CONTROL #', 'CONTROL NUMBER', 'CONTROL NO.', 'CONTROL NO', 'CONTROL');
        const key = JSON.stringify([normalize(control), timestamp, person.toUpperCase(), notes, handover]);
        const group = swabGroups.get(key);
        if (group) {
          group.names.set(normalize(sampleName), sampleName);
          group.activity.label = `${[...group.names.values()].join(', ')}${label.slice(sampleName.length)}`;
          continue;
        }
        swabGroups.set(key, { activity, names: new Map([[normalize(sampleName), sampleName]]) });
      }
      activities.push(activity);
      if (type === 'RawMats') {
        const key = JSON.stringify([normalize(sampleName), normalize(batch)]);
        const source = cell(row, 'SOURCE')
          .replace(/^MX\s+Sampling\s+Port\s+(\d+)$/i, 'MX-SP$1')
          .replace(/^Storage\s+Tank\s+(\d+)$/i, 'ST$1');
        if (!materialGroups.has(key)) materialGroups.set(key, []);
        materialGroups.get(key)!.push({ activity, name: sampleName, source });
      }
    }
    for (const group of materialGroups.values()) {
      if (group.length < 2) continue;
      for (const { activity, name, source } of group) {
        if (source) activity.label = `${name} (${source})${activity.label.slice(name.length)}`;
      }
    }
    if (invalid) warnings.push(`${title}: ${invalid} row(s) excluded because the activity date/time is missing or invalid.`);
    sections.push({ title, activities });
  }
  for (const { title, activities } of sections) {
    const completed = activities.filter(activity => !activity.handover);
    if (completed.length) lines.push(title, ...groupedLines(completed));
  }
  if (sections.some(section => section.activities.some(activity => activity.handover))) {
    lines.push(`Endorse to ${shift === 'AM' ? 'Night Shift' : 'Dayshift'}`, '');
    for (const { title, activities } of sections) {
      const handovers = activities.filter(activity => activity.handover);
      if (handovers.length) lines.push(title, ...groupedLines(handovers));
    }
  }
  if (!count) lines.push('No samples recorded for this shift.', '');
  lines.push('Thank you');
  return { text: lines.join('\n'), warnings, count };
}

export function splitTelegramText(text: string): string[] {
  const chunks: string[] = [];
  while (text.length > 4000) {
    let end = text.lastIndexOf('\n', 3999) + 1;
    if (!end) end = /[\uD800-\uDBFF]/.test(text[3999]) ? 3999 : 4000;
    chunks.push(text.slice(0, end));
    text = text.slice(end);
  }
  if (text) chunks.push(text);
  return chunks;
}
