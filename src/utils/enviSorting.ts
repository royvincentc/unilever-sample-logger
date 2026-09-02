import { ENVI_CATEGORIES, EQUIPMENT_GROUPS } from '../data/sampleData';

export const ENVI_SAMPLE_ORDER = [
  "Side Pot 1 - Inner Dome",
  "Side Pot 1 - Outer Dome",
  "Side Pot 1 - Body",
  "Side Pot 1 - Stirrer",
  "Side Pot 2 - Inner Dome",
  "Side Pot 2 - Outer Dome",
  "Side Pot 2 - Body",
  "Side Pot 2 - Stirrer",
  "Premixing tank 1 - Inner Dome",
  "Premixing tank 1 - Outer Dome",
  "Premixing tank 1 - Body",
  "Premixing tank 1 - Stirrer",
  "PM1 BALL",
  "PM1 T-SHAPE CONNECTING METAL",
  "PM1 IN FLEXIBLE HOSE",
  "PM1 OUT FLEXIBLE HOSE",
  "Premixing tank 1 Pump - Ball",
  "Premixing tank 1 Pump - Metal",
  "Premixing tank 1 Pump - Inlet",
  "Premixing tank 1 Pump - Outlet",
  "Premixing tank 2 - Inner Dome",
  "Premixing tank 2 - Outer Dome",
  "Premixing tank 2 - Body",
  "Premixing tank 2 - Stirrer",
  "PM2 BALL",
  "Premixing tank 2 Pump - Ball",
  "PM2 T-SHAPE CONNECTING METAL",
  "Premixing tank 2 Pump - Metal",
  "PM2 IN FLEXIBLE HOSE",
  "PM2 OUT FLEXIBLE HOSE",
  "Premixing tank 2 Pump - Inlet",
  "Premixing tank 2 Pump - Outlet",
  "Premixing tank 2 Pump Filter - Bottom",
  "Premixing tank 2 Pump Filter - Top",
  "Premixing tank 3 - Inner Dome",
  "Premixing tank 3 - Outer Dome",
  "Premixing tank 3 - Body",
  "Premixing tank 3 - Stirrer",
  "Premixing tank 4 - Inner Dome",
  "Premixing tank 4 - Outer Dome",
  "Premixing tank 4 - Body",
  "Premixing tank 4 - Stirrer",
  "Main Mixing Tank 1 - Inner Dome",
  "Main Mixing Tank 1 - Outer Dome",
  "Main Mixing Tank 1 - Body",
  "Main Mixing Tank 1 - Stirrer",
  "Main Mixing Tank 1 - Sampling Port 1",
  "Main Mixing Tank 1 - Sampling Port 2",
  "Main Mixing Tank 1 Filter - Top",
  "Main Mixing Tank 1 Filter - Bottom",
  "Storage Tank 1 - Inner Dome",
  "Storage Tank 1- Outer Dome",
  "Storage Tank 1 - Outer Dome",
  "Storage Tank 1 - Body",
  "Storage Tank 1 - Screen",
  "Storage Tank 2 - Inner Dome",
  "Storage Tank 2- Outer Dome",
  "Storage Tank 2 - Outer Dome",
  "Storage Tank 2 - Body",
  "Storage Tank 2 - Body ",
  "Storage Tank 3 - Inner Dome",
  "Storage Tank 3 - Outer Dome",
  "Storage Tank 3 - Body",
  "Storage Tank 4- Inner Dome",
  "Storage Tank 4 - Inner Dome",
  "Storage Tank 4 - Outer Dome",
  "Storage Tank 4 - Body",
  "Leepack - Cover",
  "Leepack - Body",
  "Leepack - Nozzle 1",
  "Leepack - Nozzle 2",
  "Leepack - Nozzle 3",
  "Leepack - Nozzle 4",
  "Leepack - Hose 1",
  "Leepack - Hose 2",
  "Leepack - Hose 3",
  "Leepack - Hose 4",
  "LEEPACK DOME",
  "Leepack Hopper Cover",
  "LEEPACK BODY",
  "Leepack Hopper Body",
  "Leepack Nozzle 1",
  "LEEPACK NOZZLE 2",
  "LEEPACK NOZZLE 3",
  "LEEPACK NOZZLE 4",
  "Leepack Nozzle 2",
  "Leepack Nozzle 3",
  "Leepack Nozzle 4",
  "LEEPACK JOINT 1",
  "LEEPACK JOINT 1",
  "Leepack Hose 1",
  "LEEPACK JOINT 2",
  "LEEPACK JOINT 3",
  "LEEPACK JOINT 4",
  "Leepack Hose 2",
  "Leepack Hose 3",
  "Leepack Hose 4",
  "AKASH 1 HOPPER COVER INNER DOME",
  "AKASH 1 HOPPER COVER OUTER DOME",
  "Akash 1 Hopper - Inner Dome",
  "Akash 1 Hopper - Outer Dome",
  "AKASH 1 HOPPER BODY",
  "Akash 1 Hopper - Body",
  "AKASH 1 HOPPER DRAIN",
  "Akash 1 Hopper - Drain",
  "Akash 1 Nozzle 1",
  "Akash 1 Nozzle 2",
  "Akash 1 Nozzle 3",
  "Akash 1 Nozzle 4",
  "Akash 1 Nozzle 5",
  "Akash 1 Nozzle 6",
  "AKASH 2 HOPPER COVER INNER DOME",
  "AKASH 2 HOPPER COVER OUTER DOME",
  "Akash 2 Hopper - Inner Dome",
  "Akash 2 Hopper - Outer Dome",
  "AKASH 2 HOPPER BODY",
  "Akash 2 Hopper - Body",
  "AKASH 2 HOPPER DRAIN",
  "Akash 2 Hopper - Drain",
  "Akash 2 Nozzle 1",
  "Akash 2 Nozzle 2",
  "Akash 2 Nozzle 3",
  "Akash 2 Nozzle 4",
  "Akash 2 Nozzle 5",
  "Akash 2  Nozzle 5",
  "Akash 2 Nozzle 6",
  "MV01 Inner Dome ",
  "MV01 Outer Dome",
  "MV01 Body ",
  "MV01 Stirrer",
  "Storage Tank 1 - Inner Dome (CIP+SWAB)",
  "Storage Tank 1 - Outer Dome (CIP+SWAB)",
  "Storage Tank 1 - Body (CIP+SWAB)",
  "Storage Tank 1 - Inner Dome (Manual + Alcohol)",
  "Storage Tank 1 - Outer Dome (Manual + Alcohol)",
  "Storage Tank 1 - Body (Manual + Alcohol)"
];

const CLEAN_CACHE = new Map<string, string>();
function clean(s: string) {
  if (!s) return '';
  const cached = CLEAN_CACHE.get(s);
  if (cached) return cached;
  const res = s.trim().toUpperCase().replace(/\s+/g, ' ');
  CLEAN_CACHE.set(s, res);
  return res;
}

export function getEnviSortIndex(sampleName: string): number {
  if (!sampleName) return 9999;
  const cleanName = clean(sampleName);
  const index = ENVI_SAMPLE_ORDER.findIndex(n => clean(n) === cleanName);
  return index !== -1 ? index : 9999;
}

// Fallback logic for when cluster is small, or mixed, or doesn't match a big category
function getBaseEquipmentName(sampleName: string): string {
  if (!sampleName) return '';
  const upper = sampleName.toUpperCase();
  
  if (upper.includes("STORAGE TANK 1")) return "Storage Tank 1";
  if (upper.includes("STORAGE TANK 2")) return "Storage Tank 2";
  if (upper.includes("STORAGE TANK 3")) return "Storage Tank 3";
  if (upper.includes("STORAGE TANK 4")) return "Storage Tank 4";
  
  if (upper.includes("SIDE POT 1")) return "Side Pot 1";
  if (upper.includes("SIDE POT 2")) return "Side Pot 2";
  
  if (upper.includes("PREMIXING TANK 1 PUMP") || upper.includes("PM1")) return "Premixing Tank 1 Pump";
  if (upper.includes("PREMIXING TANK 1")) return "Premixing Tank 1";
  
  if (upper.includes("PREMIXING TANK 2 PUMP") || upper.includes("PM2")) return "Premixing Tank 2 Pump";
  if (upper.includes("PREMIXING TANK 2")) return "Premixing Tank 2";
  
  if (upper.includes("PREMIXING TANK 3")) return "Premixing Tank 3";
  if (upper.includes("PREMIXING TANK 4")) return "Premixing Tank 4";
  
  if (upper.includes("MAIN MIXING TANK 1")) return "Main Mixing Tank 1";
  
  if (upper.includes("LEEPACK")) return "Leepack";
  
  if (upper.includes("AKASH 1")) return "Akash 1";
  if (upper.includes("AKASH 2")) return "Akash 2";
  
  if (upper.includes("MV01")) return "MV01";
  
  const parts = sampleName.split('-');
  if (parts.length > 1) {
    return parts[0].trim();
  }
  
  return sampleName.trim();
}

/**
 * Derives the best group name for a cluster of samples sharing the same Control Number.
 * 1. Checks if the cluster closely matches a major preset (e.g. LIQUID DETERGENT, FABCON).
 * 2. If it perfectly matches a single equipment group (e.g. LEEPACK), returns that.
 * 3. Otherwise, returns the most common base equipment name in the cluster.
 */
export function getEnviClusterGroupName(samples: string[]): string {
  if (!samples || samples.length === 0) return '';
  
  const sampleSet = new Set(samples.map(s => clean(s)));
  
  // Pre-calculate expected samples for each preset category
  for (const cat of ENVI_CATEGORIES) {
    if (cat.id === 'Other') continue;
    
    // Collect all expected samples for this category
    const expectedSamples = new Set<string>();
    for (const eqId of cat.equipmentIds) {
      const eq = EQUIPMENT_GROUPS[eqId];
      if (eq) {
        eq.samples.forEach(s => expectedSamples.add(clean(s)));
      }
    }
    
    // Check overlap
    if (expectedSamples.size > 0) {
      let matches = 0;
      for (const s of sampleSet) {
        if (expectedSamples.has(s)) matches++;
      }
      
      // If the cluster has at least 80% of the expected samples, AND the cluster doesn't have way too many extra samples
      const matchRatio = matches / expectedSamples.size;
      const extraSamples = sampleSet.size - matches;
      
      // If it's a huge category like LIQUID DETERGENT, and it matches most of it
      if (matchRatio >= 0.7 && extraSamples <= 5) {
        return cat.label;
      }
    }
  }

  // Fallback: determine the most common base equipment name
  const counts = new Map<string, number>();
  for (const s of samples) {
    const base = getBaseEquipmentName(s);
    counts.set(base, (counts.get(base) || 0) + 1);
  }
  
  let bestBase = '';
  let max = 0;
  for (const [base, count] of counts.entries()) {
    if (count > max) {
      max = count;
      bestBase = base;
    }
  }
  
  return bestBase || samples[0];
}
