// ===== SAMPLE TYPES =====
export type SampleType = 'ENVI' | 'WATER' | 'RawMats';

// ===== STATUS =====
export type SampleStatus = 'ONGOING' | 'PENDING RELEASE' | 'RELEASED' | 'COMPLETED';

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
}

// ===== WATER =====
export type WaterSource = 'Chlorine Tank 1' | 'Chlorine Tank 2' | 'Demin Water' | 'RO Water System';

export interface WaterFormData {
  dateSampled: string;
  timeSampled: string;
  waterSource: WaterSource | '';
  sampledBy: string;
  dateAnalyzed: string;
  analyzedBy: string;
  status: SampleStatus;
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
}

// ===== SETTINGS =====
export interface AppSettings {
  webhookUrls: {
    envi: string;
    water: string;
    rawmats: string;
  };
  spreadsheetId: string;
  theme: 'light' | 'dark' | 'system';
  authMode: 'password' | 'pin';
  pin: string;
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
