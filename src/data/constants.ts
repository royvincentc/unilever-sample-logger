import type { SampleStatus } from '../types';

// ===== MONTH ABBREVIATIONS =====
export const MONTH_ABBR = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
] as const;

// ===== STATUS OPTIONS =====
export const STATUS_OPTIONS: SampleStatus[] = [
  'ON GOING',
  'PENDING RELEASE',
  'RELEASED',
];

// ===== WATER SOURCES =====
export const WATER_SOURCES = [
  'Chlorine Tank 1',
  'Chlorine Tank 2',
  'Demin Water',
  'RO Water System',
  'QCL Deionized Water',
  'QCL Chlorine Water',
  'COP Chlorine Water',
] as const;

// ===== RAWMATS TYPES =====
export const RAWMATS_TYPES = ['SFG', 'CUC', 'ROH'] as const;

// ===== RFAF OPTIONS =====
export const RFAF_OPTIONS = ['WITH RFAF', 'NONE'] as const;

// ===== RAWMATS SAMPLES =====
export const RAWMATS_SAMPLES = [
  'Surf Fabric Conditioner - French Perfume',
  'Surf Fabric Conditioner - Blossom Fresh',
  'Surf Fabric Conditioner - Luxe Perfume',
  'Surf Fabric Conditioner - Antibac Mint',
  'Surf Fabric Conditioner - Charcoal Fresh',
  'Surf Fabric Conditioner - Gentle Fresh',
  'Surf Fabric Conditioner - Fresh & Bloom',
  'Surf Fabric Conditioner - Magical Blooms',
  'Surf Liquid Detergent - Cherry Blossom',
  'Surf Liquid Detergent - Sun Fresh',
  'Surf Liquid Detergent - Rose Fresh',
  'Silfoam SRE UL',
  'Mitaine CA (S)',
  'DB -310',
  'Antifoam Emulsion',
  'Lightyear',
  'ZAP C125',
  'Odisea MOC CAP',
  'Textcare SRN UL',
  'Terra 50',
  'Acid Violet 50 DYE (CI 50325) / Duasyn acid',
  'Colourant Acid Blue 80',
  'Disperse Violet 28 Dye',
  'Liquitint Blue MC',
  'Liquitint Violet CS',
  'Miliken Red MX',
  'Pink AL',
] as const;

// ===== RAWMATS SOURCES =====
export const RAWMATS_SOURCES = [
  'Storage Tank 1',
  'Storage Tank 2',
  'Storage Tank 3',
  'Storage Tank 4',
  'Main Mixing Tank',
  'MX Sampling Port 1',
  'MX Sampling Port 2',
  'AKASH 1',
  'AKASH 2',
  'LEEPACK',
  'IBC TANK',
  'PALLECON',
] as const;

export const DEFAULT_SETTINGS = {
  spreadsheetId: '1yfoeCEFrL6AYftrmjcuAqsWU6Pu2bZ_mahaUvs9TzbI',
  theme: 'system' as const,
  authMode: 'password' as const,
  pin: '09062025',
};

export const SPREADSHEETS = {
  practice: '12GkLM06FaO9Qn_E4TDQp852nUvf53mxl6nUI9C9GEdc',
  official: '1yfoeCEFrL6AYftrmjcuAqsWU6Pu2bZ_mahaUvs9TzbI'
};

// ===== AUTH CREDENTIALS =====
export const AUTH_USERS = [
  { username: 'pf4micro@ipi.ph', password: 'ULmicrobiology_2025', name: 'PF4' },
  { username: 'vincecodinera@gmail.com', password: 'Vincent81101!!', name: 'Roy' }
];

export const PIN_USERS = [
  { pin: '09062025', name: 'Louis' },
  { pin: '12162023', name: 'Roy' }
];
