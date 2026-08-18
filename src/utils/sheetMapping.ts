import type { SampleType } from '../types';

/**
 * Get the sheet tab name for a given sample type and optional subtype.
 * Subtype is used to distinguish between RM and SFG/FG for RawMats.
 */
export function getSheetTabName(sampleType: SampleType, subType?: string, overrideDate?: Date): string {
  const date = overrideDate || new Date();
  const yearStr = date.getFullYear().toString();
  
  if (sampleType === 'ENVI') return `SWAB ${yearStr}`;
  if (sampleType === 'WATER') return `WATER ${yearStr}`;
  if (sampleType === 'AIR') return `AIR ${yearStr}`;
  
  if (sampleType === 'RawMats') {
    return `RM,FG,SFG ${yearStr}`;
  }
  
  return '';
}

/**
 * Kept for backward compatibility if any legacy code calls this.
 * The new system does not rely on dates for tab names.
 */
export function getYearShort(dateStr: string): string {
  const date = new Date(dateStr);
  return String(date.getFullYear()).slice(-2);
}
