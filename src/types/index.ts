// ===== SAMPLE TYPES =====
export type SampleType = 'ENVI' | 'WATER' | 'RawMats' | 'AIR';

// ===== STATUS =====
export type SampleStatus = 'ONGOING' | 'ON GOING' | 'PENDING RELEASE' | 'RELEASED' | 'COMPLETED' | '';

// ===== ENVI =====
export type EnviCategory =
  | 'FABCON'
  | 'LIQUID DETERGENT'
  | 'STORAGE TANKS'
  | 'FILLING - AKASH 1'
  | 'FILLING - AKASH 2'
  | 'FILLING - LEEPACK'
  | 'COP Swabbing'
  | 'MV01'
  | 'Other';

export interface EnviEquipmentGroup {
  id: string;
  label: string;
  samples: string[];
}

export interface EnviFormData {
  dateSampled: string;
  timeSampled: string;
  categories: string[];
  selectedSamples: string[];
  swabbedBy: string;
  dateAnalyzed: string;
  analyzedBy: string;
  status: SampleStatus;
  endorsedTo?: string;
  remarks?: string;
  qty?: string;
  unit?: string;
}

// ===== WATER =====
export interface WaterFormData {
  dateSampled: string;
  timeSampled: string;
  waterSource: string;
  sampledBy: string;
  dateAnalyzed: string;
  analyzedBy: string;
  status: SampleStatus;
  endorsedTo?: string;
  remarks?: string;
  qty?: string;
  unit?: string;
}

// ===== RAWMATS =====
export type RawMatsType = 'SFG' | 'CUC' | 'ROH';

export interface RawMatsFormData {
  dateSampled: string;
  timeSampled: string;
  rfaf: string;
  batchNo: string;
  mixingBatchNo?: string;
  cucNo?: string;
  qty?: string;
  unit?: string;
  type: RawMatsType | '';
  sample: string;
  source: string;
  receivedBy: string;
  dateAnalyzed: string;
  analyzedBy: string;
  status: SampleStatus;
  dateReleased?: string;
  releasedBy?: string;
  endorsedTo?: string;
  remarks?: string;
  repeatedResults?: string;
}

// ===== AIR =====
export interface AirFormData {
  method: string;
  samplingPoints: string[];
  dateSampled: string;
  timeSampled: string;
  performedBy: string;
  status: SampleStatus;
  remarks?: string;
}

// ===== SUBMISSION QUEUE =====
export type QueueItemStatus = 'queued' | 'sending' | 'success' | 'failed';

export interface QueueItem {
  id: string;
  sampleType: SampleType;
  formData: EnviFormData | WaterFormData | RawMatsFormData | AirFormData;
  status: QueueItemStatus;
  createdAt: string;
  lastAttempt?: string;
  errorMessage?: string;
  controlNumber?: string;
  sampleName?: string;
  submittedBy?: string;
}

// ===== SETTINGS =====
export interface AppSettings {
  spreadsheetId: string;
  theme: 'light' | 'dark' | 'system';
  authMode: 'password' | 'pin';
  pin: string;
}

// Represents the live schema fetched from the sheet header row.
export interface SheetSchema {
  sampleType: SampleType;
  sheetTab: string;
  headers: string[];      // All column headers in order
  fetchedAt: string;      // ISO timestamp
}
export interface HistoryEntry {
  id: string;
  sampleType: SampleType;
  controlNumber: string;
  sampleName: string;
  dateSampled: string;
  dateAnalyzed?: string;
  rawMatsType?: string; // SFG, FG, ROH, CUC
  status: SampleStatus;
  submittedAt: string;
  submittedBy: string;
  endorsedTo?: string;
  sheetAnalyst?: string; // Add synced analyst from Google Sheet
  results?: any; // To store the logged results
}
