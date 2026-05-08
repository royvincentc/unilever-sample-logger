import { MONTH_ABBR } from '../data/constants';

/**
 * Get the sheet tab name for a given date and sample type.
 * e.g. date = "2026-05-06", type = "ENVI" → "MAY ENVI"
 * e.g. date = "2026-01-15", type = "WATER" → "JAN WATER"
 * e.g. date = "2026-03-20", type = "RawMats,FG&SFG" → "MAR RawMats,FG&SFG"
 */
export function getSheetTabName(dateStr: string, sampleType: 'ENVI' | 'WATER' | 'RawMats'): string {
  const date = new Date(dateStr);
  const monthIndex = date.getMonth();
  const monthAbbr = MONTH_ABBR[monthIndex];
  
  const typeMap = {
    'ENVI': 'ENVI',
    'WATER': 'WATER',
    'RawMats': 'RawMats,FG&SFG',
  };
  
  return `${monthAbbr} ${typeMap[sampleType]}`;
}

/**
 * Get the 2-digit year from a date string
 */
export function getYearShort(dateStr: string): string {
  const date = new Date(dateStr);
  return String(date.getFullYear()).slice(-2);
}
