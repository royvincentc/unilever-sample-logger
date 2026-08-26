import type { EnviCategory, EnviEquipmentGroup } from '../types';

// ===== ENVI CATEGORIES AND THEIR EQUIPMENT =====
export const ENVI_CATEGORIES: { id: EnviCategory; label: string; equipmentIds: string[] }[] = [
  {
    id: 'FABCON',
    label: 'FABCON',
    equipmentIds: ['SP01', 'PM01', 'PM01_PUMP', 'PM02', 'PM02_PUMP', 'PM02_FILTER', 'PM03', 'PM04', 'MX01'],
  },
  {
    id: 'LIQUID DETERGENT',
    label: 'LIQUID DETERGENT',
    equipmentIds: ['SP01', 'SP02', 'PM01', 'PM01_PUMP', 'PM02', 'PM02_FILTER', 'MX01'],
  },
  {
    id: 'STORAGE TANKS',
    label: 'STORAGE TANKS',
    equipmentIds: ['ST1', 'ST2', 'ST3', 'ST4'],
  },
  {
    id: 'FILLING - AKASH 1',
    label: 'FILLING - AKASH 1',
    equipmentIds: ['AKASH1'],
  },
  {
    id: 'FILLING - AKASH 2',
    label: 'FILLING - AKASH 2',
    equipmentIds: ['AKASH2'],
  },
  {
    id: 'FILLING - LEEPACK',
    label: 'FILLING - LEEPACK',
    equipmentIds: ['LEEPACK'],
  },
  {
    id: 'MV01',
    label: 'MV01',
    equipmentIds: ['MV01'],
  },
  {
    id: 'Other',
    label: 'Other',
    equipmentIds: [],
  },
];

// ===== ALL EQUIPMENT GROUPS WITH SAMPLES =====
export const EQUIPMENT_GROUPS: Record<string, EnviEquipmentGroup> = {
  SP01: {
    id: 'SP01',
    label: 'SP01',
    samples: [
      'Side Pot 1 - Inner Dome',
      'Side Pot 1 - Outer Dome',
      'Side Pot 1 - Body',
      'Side Pot 1 - Stirrer',
    ],
  },
  SP02: {
    id: 'SP02',
    label: 'SP02',
    samples: [
      'Side Pot 2 - Inner Dome',
      'Side Pot 2 - Outer Dome',
      'Side Pot 2 - Body',
      'Side Pot 2 - Stirrer',
    ],
  },
  PM01: {
    id: 'PM01',
    label: 'PM01',
    samples: [
      'Premixing tank 1 - Inner Dome',
      'Premixing tank 1 - Outer Dome',
      'Premixing tank 1 - Body',
      'Premixing tank 1 - Stirrer',
    ],
  },
  PM01_PUMP: {
    id: 'PM01_PUMP',
    label: 'PM01 pump',
    samples: [
      'PM1 BALL',
      'PM1 T-SHAPE CONNECTING METAL',
      'PM1 IN FLEXIBLE HOSE',
      'PM1 OUT FLEXIBLE HOSE',
    ],
  },
  PM02: {
    id: 'PM02',
    label: 'PM02',
    samples: [
      'Premixing tank 2 - Inner Dome',
      'Premixing tank 2 - Outer Dome',
      'Premixing tank 2 - Body',
      'Premixing tank 2 - Stirrer',
    ],
  },
  PM02_PUMP: {
    id: 'PM02_PUMP',
    label: 'PM02 pump',
    samples: [
      'PM2 BALL',
      'PM2 T-SHAPE CONNECTING METAL',
      'PM2 IN FLEXIBLE HOSE',
      'PM2 OUT FLEXIBLE HOSE',
    ],
  },
  PM02_FILTER: {
    id: 'PM02_FILTER',
    label: 'PM02 filter',
    samples: [
      'Premixing tank 2 Pump Filter - Top',
      'Premixing tank 2 Pump Filter - Bottom',
    ],
  },
  PM03: {
    id: 'PM03',
    label: 'PM03',
    samples: [
      'Premixing tank 3 - Inner Dome',
      'Premixing tank 3 - Outer Dome',
      'Premixing tank 3 - Body',
      'Premixing tank 3 - Stirrer',
    ],
  },
  PM04: {
    id: 'PM04',
    label: 'PM04',
    samples: [
      'Premixing tank 4 - Inner Dome',
      'Premixing tank 4 - Outer Dome',
      'Premixing tank 4 - Body',
      'Premixing tank 4 - Stirrer',
    ],
  },
  MV01: {
    id: 'MV01',
    label: 'MV01',
    samples: [
      'MV01 - Inner Dome',
      'MV01 - Outer Dome',
      'MV01 - Body',
      'MV01 - Stirrer',
    ],
  },
  MX01: {
    id: 'MX01',
    label: 'MX01',
    samples: [
      'Main Mixing Tank 1 - Inner Dome',
      'Main Mixing Tank 1 - Outer Dome',
      'Main Mixing Tank 1 - Body',
      'Main Mixing Tank 1 - Stirrer',
      'Main Mixing Tank 1 - Sampling Port 1',
      'Main Mixing Tank 1 - Sampling Port 2',
      'Main Mixing Tank 1 Filter - Top',
      'Main Mixing Tank 1 Filter - Bottom',
    ],
  },
  ST1: {
    id: 'ST1',
    label: 'ST1',
    samples: [
      'Storage Tank 1 - Inner Dome',
      'Storage Tank 1 - Outer Dome',
      'Storage Tank 1 - Body',
    ],
  },
  ST2: {
    id: 'ST2',
    label: 'ST2',
    samples: [
      'Storage Tank 2 - Inner Dome',
      'Storage Tank 2- Outer Dome',
      'Storage Tank 2 - Body',
    ],
  },
  ST3: {
    id: 'ST3',
    label: 'ST3',
    samples: [
      'Storage Tank 3 - Inner Dome',
      'Storage Tank 3 - Outer Dome',
      'Storage Tank 3 - Body',
    ],
  },
  ST4: {
    id: 'ST4',
    label: 'ST4',
    samples: [
      'Storage Tank 4 - Inner Dome',
      'Storage Tank 4 - Outer Dome',
      'Storage Tank 4 - Body',
    ],
  },
  AKASH1: {
    id: 'AKASH1',
    label: 'AKASH 1',
    samples: [
      'AKASH 1 HOPPER COVER OUTER DOME',
      'AKASH 1 HOPPER COVER INNER DOME',
      'AKASH 1 HOPPER DRAIN',
      'AKASH 1 HOPPER BODY',
      'AKASH 1 NOZZLE 1',
      'AKASH 1 NOZZLE 2',
      'AKASH 1 NOZZLE 3',
      'AKASH 1 NOZZLE 4',
      'AKASH 1 NOZZLE 5',
      'AKASH 1 NOZZLE 6',
    ],
  },
  AKASH2: {
    id: 'AKASH2',
    label: 'AKASH 2',
    samples: [
      'AKASH 2 HOPPER COVER OUTER DOME',
      'AKASH 2 HOPPER COVER INNER DOME',
      'AKASH 2 HOPPER DRAIN',
      'AKASH 2 HOPPER BODY',
      'AKASH 2 NOZZLE 1',
      'AKASH 2 NOZZLE 2',
      'AKASH 2 NOZZLE 3',
      'AKASH 2 NOZZLE 4',
      'AKASH 2 NOZZLE 5',
      'AKASH 2 NOZZLE 6',
    ],
  },
  LEEPACK: {
    id: 'LEEPACK',
    label: 'LEEPACK',
    samples: [
      'LEEPACK DOME',
      'LEEPACK BODY',
      'LEEPACK NOZZLE 1',
      'LEEPACK NOZZLE 2',
      'LEEPACK NOZZLE 3',
      'LEEPACK NOZZLE 4',
      'LEEPACK JOINT 1',
      'LEEPACK JOINT 2',
      'LEEPACK JOINT 3',
      'LEEPACK JOINT 4',
    ],
  },
};

// Helper: get equipment groups for a single category
export function getEquipmentForCategory(category: EnviCategory): EnviEquipmentGroup[] {
  const cat = ENVI_CATEGORIES.find(c => c.id === category);
  if (!cat) return [];
  return cat.equipmentIds.map(id => EQUIPMENT_GROUPS[id]).filter(Boolean);
}

// Helper: get deduplicated equipment groups for multiple categories
export function getEquipmentForCategories(categories: EnviCategory[]): EnviEquipmentGroup[] {
  const allEquipmentIds = new Set<string>();
  categories.forEach(category => {
    const cat = ENVI_CATEGORIES.find(c => c.id === category);
    if (cat) {
      cat.equipmentIds.forEach(id => allEquipmentIds.add(id));
    }
  });
  
  return Array.from(allEquipmentIds).map(id => EQUIPMENT_GROUPS[id]).filter(Boolean);
}
