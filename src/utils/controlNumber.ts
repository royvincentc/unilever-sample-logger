import type { SampleType } from '../types';
import { getYearShort } from './sheetMapping';

/** Find the numeric maximum for this sample type and year, regardless of row order. */
export function findHighestControlNumber(
  sampleType: SampleType,
  controlNumbers: string[],
  dateStr: string
): string | null {
  const prefix = generateNextControlNumber(sampleType, null, dateStr).split('-')[0];
  let highest: string | null = null;
  let highestSequence = 0;
  for (const raw of controlNumbers) {
    const control = (sampleType === 'RawMats' ? raw.replace(/^RM-?/i, '') : raw).trim();
    const match = control.match(/^([A-Z]?\d{2})-(\d+)$/i);
    if (!match || match[1].toUpperCase() !== prefix) continue;
    const sequence = Number(match[2]);
    if (Number.isSafeInteger(sequence) && sequence > highestSequence) {
      highest = control.toUpperCase();
      highestSequence = sequence;
    }
  }
  return highest;
}

/**
 * Generate next control number based on the previous one.
 * 
 * ENVI:    E26-001, E26-002, ...
 * WATER:   W26-001, W26-002, ...
 * RawMats: 26-001, 26-002, ...
 */
export function generateNextControlNumber(
  sampleType: SampleType,
  previousControlNumber: string | null,
  dateStr: string
): string {
  const year = getYearShort(dateStr);
  
  if (!previousControlNumber) {
    // First entry
    switch (sampleType) {
      case 'ENVI': return `E${year}-001`;
      case 'WATER': return `W${year}-001`;
      case 'RawMats': return `${year}-001`;
      case 'AIR': return `A${year}-001`;
      default: return `C${year}-001`;
    }
  }
  
  // Extract the numeric portion from previous control number
  const parts = previousControlNumber.split('-');
  const lastNum = parseInt(parts[parts.length - 1], 10) || 0;
  const nextNum = lastNum + 1;
  const padded = String(nextNum).padStart(3, '0');
  
  switch (sampleType) {
    case 'ENVI': return `E${year}-${padded}`;
    case 'WATER': return `W${year}-${padded}`;
    case 'RawMats': return `${year}-${padded}`;
    case 'AIR': return `A${year}-${padded}`;
    default: return `C${year}-${padded}`;
  }
}

/**
 * Parse control number to get the numeric part
 */
export function getControlNumberSequence(controlNumber: string): number {
  const parts = controlNumber.split('-');
  return parseInt(parts[parts.length - 1], 10);
}
