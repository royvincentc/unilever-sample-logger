// ===== SAMPLE TYPES =====
export type SampleType = 'ENVI' | 'WATER' | 'RawMats';

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
  | 'MV01';

export interface EnviEquipmentGroup {
  id: string;
  label: string;
  samples: string[];
}

export interface EnviFormData {
  dateSampled: string;
  timeSampled: string;
  categories: EnviCategory[];
  selectedSamples: string[];
  swabbedBy: string;
  dateAnalyzed: string;
  analyzedBy: string;
  status: SampleStatus;
  remarks?: string;
}

// ===== WATER =====
export type WaterSource = 'Chlorine Tank 1' | 'Chlorine Tank 2' | 'Demin Water' | 'RO Water System' | 'QCL Deionized Water' | 'QCL Chlorine Water' | 'COP Chlorine Water';

export interface WaterFormData {
  dateSampled: string;
  timeSampled: string;
  waterSource: WaterSource | '';
  sampledBy: string;
  dateAnalyzed: string;
  analyzedBy: string;
  status: SampleStatus;
  remarks?: string;
}

// ===== RAWMATS =====
export type RawMatsType = 'SFG' | 'CUC' | 'ROH';
export type RfafOption = 'WITH RFAF' | 'NONE';

export interface RawMatsFormData {
  dateSampled: string;
  timeSampled: string;
  rfaf: RfafOption | '';
  mixingBatchNo: string;
  cucNo: string;
  type: RawMatsType | '';
  sample: string;
  source: string;
  qty: string;
  unit: string;
  receivedBy: string;
  dateAnalyzed: string;
  analyzedBy: string;
  status: SampleStatus;
  remarks?: string;
}

// ===== SUBMISSION QUEUE =====
export type QueueItemStatus = 'queued' | 'sending' | 'success' | 'failed';

export interface QueueItem {
  id: string;
  sampleType: SampleType;
  formData: EnviFormData | WaterFormData | RawMatsFormData;
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
  webhookUrls: {
    envi: string;
    water: string;
    rawmats: string;
    sync?: string;
    liveSheet?: string;
    schema?: string; // n8n get-sheet-schema endpoint
  };
  spreadsheetId: string;
  theme: 'light' | 'dark' | 'system';
  authMode: 'password' | 'pin';
  pin: string;
  columnMappings?: {
    envi?: ColumnMapping[];
    water?: ColumnMapping[];
    rawmats?: ColumnMapping[];
  };
}

// ===== COLUMN MAPPING =====
// Maps the webapp's internal "logical" field name to whatever the
// current Google Sheet column header actually says.
export interface ColumnMapping {
  logicalName: string; // e.g. 'WATER SOURCE' — what the app calls it
  sheetColumn: string; // e.g. 'WATER SUPPLY' — current name in the sheet
}

// Represents the live schema fetched from the sheet header row.
export interface SheetSchema {
  sampleType: SampleType;
  sheetTab: string;
  headers: string[];      // All column headers in order
  fetchedAt: string;      // ISO timestamp
}

// ===== HISTORY =====
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
  results?: any; // To store the logged results
}
