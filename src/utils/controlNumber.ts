import type { SampleType } from '../types';
import { getYearShort } from './sheetMapping';

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
    }
  }
  
  // Extract the numeric portion from previous control number
  const parts = previousControlNumber.split('-');
  const lastNum = parseInt(parts[parts.length - 1], 10);
  const nextNum = lastNum + 1;
  const padded = String(nextNum).padStart(3, '0');
  
  switch (sampleType) {
    case 'ENVI': return `E${year}-${padded}`;
    case 'WATER': return `W${year}-${padded}`;
    case 'RawMats': return `${year}-${padded}`;
  }
}

/**
 * Parse control number to get the numeric part
 */
export function getControlNumberSequence(controlNumber: string): number {
  const parts = controlNumber.split('-');
  return parseInt(parts[parts.length - 1], 10);
}
