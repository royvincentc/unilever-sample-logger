import type { EnviEquipmentGroup } from '../types';
import { RAWMATS_SAMPLES, RAWMATS_SOURCES, RFAF_OPTIONS, WATER_SOURCES } from './constants.js';
import { ENVI_CATEGORIES, EQUIPMENT_GROUPS } from './sampleData.js';

export const catalogLists = {
  rawSamples: 'Sample names',
  rawSources: 'Sources',
  rfaf: 'RFAF choices',
  waterSources: 'Water sources',
  airMethods: 'Sampling methods',
  airPoints: 'Sampling points',
} as const;

export interface EnviCatalogCategory {
  id: string;
  label: string;
  groups: EnviEquipmentGroup[];
  custom: boolean;
}

export type CatalogList = keyof typeof catalogLists;
export type SampleCatalog = Record<CatalogList, string[]> & { envi: EnviCatalogCategory[] };

export const defaultSampleCatalog: SampleCatalog = {
  envi: ENVI_CATEGORIES.map(category => ({
    id: category.id,
    label: category.label,
    groups: category.equipmentIds.map(id => EQUIPMENT_GROUPS[id]),
    custom: category.id === 'Other',
  })),
  rawSamples: [...RAWMATS_SAMPLES],
  rawSources: [...RAWMATS_SOURCES],
  rfaf: [...RFAF_OPTIONS],
  waterSources: [...WATER_SOURCES],
  airMethods: ['ACTIVE', 'PASSIVE'],
  airPoints: [
    'Compounding Area: Corner 1',
    'Compounding Area: Corner 2',
    'Compounding Area: Corner 3',
    'Compounding Area: Corner 4',
    'Compounding Area: Center',
    'Compounding Area: Main Mixing Tank Center',
    'Filling Area: Akash 1 - Near Nozzle',
    'Filling Area: Akash 1 - Near Packaging',
    'Filling Area: Akash 2 - Near Nozzle',
    'Filling Area: Akash 2 - Near Packaging',
    'Filling Area: Leepack - Near Nozzle',
    'Filling Area: Leepack - Near Packaging',
    'Dispensary Area: Center',
  ],
};

const text = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 200 &&
  value === value.trim() && !/^[=']|[\r\n]/.test(value);

function validList(values: unknown): values is string[] {
  return Array.isArray(values) && values.length > 0 && values.length <= 500 &&
    values.every(text) && new Set(values.map(value => value.toLowerCase())).size === values.length;
}

export function validateSampleCatalog(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return 'A sample catalog is required.';
  const catalog = value as SampleCatalog;
  for (const key of Object.keys(catalogLists) as CatalogList[]) {
    if (!validList(catalog[key])) return `${catalogLists[key]} needs unique, nonblank choices without leading = or apostrophes.`;
  }
  if (!Array.isArray(catalog.envi) || !validList(catalog.envi.map(category => category?.label)) ||
      !validList(catalog.envi.map(category => category?.id))) return 'Envi needs unique, nonblank category names.';
  for (const category of catalog.envi) {
    if (typeof category.custom !== 'boolean' || !Array.isArray(category.groups) ||
        (category.groups.length === 0 && !category.custom) ||
        (category.groups.length > 0 && (!validList(category.groups.map(group => group?.id)) ||
          !validList(category.groups.map(group => group?.label))))) {
      return `${category.label} needs uniquely named groups or custom swab points.`;
    }
    for (const group of category.groups) {
      if (!validList(group.samples)) return `${category.label} / ${group.label} needs unique, nonblank sample names.`;
    }
  }
}

export function getEnviCatalogGroups(catalog: EnviCatalogCategory[], selected: string[]): EnviEquipmentGroup[] {
  const seen = new Set<string>();
  return catalog.filter(category => selected.includes(category.label)).flatMap(category =>
    category.groups.flatMap(group => {
      const key = JSON.stringify([group.label, group.samples]);
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ ...group, id: `${category.id}/${group.id}` }];
    }),
  );
}
