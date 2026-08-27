import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '../components/Layout/Header';
import SampleTypeSelector from '../components/forms/SampleTypeSelector';
import EnviForm from '../components/forms/EnviForm';
import WaterForm from '../components/forms/WaterForm';
import RawMatsForm from '../components/forms/RawMatsForm';
import AirForm from '../components/forms/AirForm';
import { useToast } from '../components/ui/Toast';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { sendToWebhook, analyseSheetForSubmission } from '../utils/api';
import { generateNextControlNumber } from '../utils/controlNumber';
import { getSheetTabName } from '../utils/sheetMapping';
import { addToQueue, addToHistory, getHighestControlNumberForSubmission } from '../utils/db';
import { getUserName } from '../utils/auth';
import { useSheetSchema, remapPayloadToLiveColumns } from '../hooks/useSheetSchema';
import type { SampleType, EnviFormData, WaterFormData, RawMatsFormData, AirFormData, QueueItem, HistoryEntry } from '../types';

import { useTheme } from '../hooks/useTheme';

interface NewSampleProps {
  onQueueUpdate: () => void;
}

export default function NewSample({ onQueueUpdate }: NewSampleProps) {
  const { theme, setTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const [selectedType, setSelectedType] = useState<SampleType | null>(null);
  const [currentDate] = useState(new Date().toISOString().split('T')[0]);
  const { showToast } = useToast();
  const isOnline = useOnlineStatus();

  // Pre-fetch live column schema when a sample type is selected so the
  // payload keys are remapped to whatever the current sheet headers say.
  const { schema } = useSheetSchema(selectedType, currentDate, isOnline);

  useEffect(() => {
    const type = searchParams.get('type') as SampleType | null;
    if (type && ['ENVI', 'WATER', 'RawMats', 'AIR'].includes(type)) {
      setSelectedType(type);
    }
  }, [searchParams]);

  const makeQueueItem = (sampleType: SampleType, formData: EnviFormData | WaterFormData | RawMatsFormData | AirFormData, sampleName: string): QueueItem => ({
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    sampleType,
    formData,
    status: 'queued',
    createdAt: new Date().toISOString(),
    sampleName,
    submittedBy: getUserName(),
  });

  const submitSample = async (
    sampleType: SampleType,
    formData: EnviFormData | WaterFormData | RawMatsFormData | AirFormData,
    sampleName: string,
    overrideControlNumber?: string
  ) => {
    try {
      const subType = sampleType === 'RawMats' ? (formData as RawMatsFormData).type : undefined;
      const sheetTab = getSheetTabName(sampleType, subType);
      const endpoint = sampleType === 'ENVI' ? 'envi' : sampleType === 'WATER' ? 'water' : sampleType === 'AIR' ? 'air' : 'rawmats';

      // For WATER, RawMats, and AIR: one sheet read returns both the incomplete row
      // control number AND the highest existing number — no double fetch.
      let controlNumber: string;
      let isUpdate = false;

      if (overrideControlNumber) {
        controlNumber = overrideControlNumber;
        isUpdate = false; // Bulks typically append new rows
      } else if (isOnline && (sampleType === 'WATER' || sampleType === 'RawMats' || sampleType === 'AIR')) {
        const { incompleteControlNumber, highestControlNumber } =
          await analyseSheetForSubmission(sampleType as 'WATER' | 'RawMats' | 'AIR', sheetTab);

        if (incompleteControlNumber) {
          // Reuse the pre-existing blank row's control number
          const year = formData.dateSampled.slice(2, 4);
          if (sampleType === 'WATER' && !incompleteControlNumber.startsWith('W')) {
            controlNumber = `W${year}-${incompleteControlNumber.split('-').pop()!.padStart(3, '0')}`;
          } else {
            controlNumber = incompleteControlNumber;
          }
          isUpdate = true;
        } else {
          // No blank row found — generate the next sequential control number
          controlNumber = generateNextControlNumber(sampleType, highestControlNumber, formData.dateSampled);
        }
      } else {
        // ENVI or offline — fall back to local DB lookup
        const highestControl = await getHighestControlNumberForSubmission(sampleType, formData.dateSampled, isOnline);
        controlNumber = generateNextControlNumber(sampleType, highestControl, formData.dateSampled);
      }

      const basePayload: Record<string, unknown> = {
        ...(formData as unknown as Record<string, unknown>),
        controlNumber,
        sheetTab,
        sampleType,
        isUpdate,
        // Ensure sample name is available for mapping
        sample: sampleName,
        // For ENVI, join categories so it's a string, just in case they add a category column
        category: (formData as any).categories ? (formData as any).categories.join(', ') : undefined,
      };

      // Remap payload field names to live sheet column headers.
      // This makes submission resilient to column renames in Google Sheets.
      const liveHeaders = schema?.headers ?? [];
      const payload = liveHeaders.length > 0
        ? {
            ...remapPayloadToLiveColumns(basePayload, liveHeaders),
            // Always preserve meta fields n8n needs (not sheet columns)
            controlNumber,
            sheetTab,
            sampleType,
            isUpdate,
          }
        : basePayload;

      if (!isOnline) {
        const queueItem = makeQueueItem(sampleType, formData, sampleName);
        queueItem.controlNumber = controlNumber;
        // Store the remapped payload so retry sends the right column names too
        queueItem.formData = payload as any; 
        await addToQueue(queueItem);
        onQueueUpdate();
        showToast('info', 'Queued', 'You\'re offline — submission queued for later');
        return;
      }

      const result = await sendToWebhook(endpoint, payload as unknown as Record<string, unknown>);
      
      // Check if webhook returned a raw n8n expression or "N/A" instead of the evaluated control number
      let finalControlNumber = (result.controlNumber && result.controlNumber !== 'N/A' && !result.controlNumber.includes('{{')) 
        ? result.controlNumber 
        : controlNumber;

      if (sampleType === 'RawMats') {
        finalControlNumber = finalControlNumber.replace(/^RM-?/i, '');
      }

      if (result.success) {
        const historyEntry: HistoryEntry = {
          id: `${finalControlNumber}-${sampleName}-${Date.now()}`,
          sampleType,
          controlNumber: finalControlNumber,
          sampleName,
          dateSampled: formData.dateSampled,
          dateAnalyzed: (formData as any).dateAnalyzed || formData.dateSampled,
          rawMatsType: (formData as any).type || null,
          status: (formData as any).status || 'ON GOING',
          submittedAt: new Date().toISOString(),
          submittedBy: getUserName(),
        };
        
        // Save locally and to Firestore (background)
        await addToHistory(historyEntry);
        
        // UI Reset and Toast
        showToast('success', 'Submitted!', `Control #: ${finalControlNumber}`);
        setSelectedType(null);
        if (onQueueUpdate) onQueueUpdate();
      } else {
        const queueItem = makeQueueItem(sampleType, formData, sampleName);
        queueItem.status = 'failed';
        queueItem.errorMessage = result.error;
        queueItem.controlNumber = controlNumber;
        queueItem.formData = payload as any;
        await addToQueue(queueItem);
        onQueueUpdate();
        showToast('error', 'Submission Failed', result.error || 'Moved to queue for retry');
      }
    } catch (error) {
      console.error('Submission error:', error);
      showToast('error', 'Error', error instanceof Error ? error.message : 'An unexpected error occurred during submission');
    }
  };

  const handleEnviSubmit = async (data: EnviFormData) => {
    // Submit a separate row for EACH selected sample, but share ONE unique control number for the whole batch
    const total = data.selectedSamples.length;
    if (total === 0) return;

    // Generate the ONE control number for the whole batch
    const highestControl = await getHighestControlNumberForSubmission('ENVI', data.dateSampled, isOnline);
    const sharedControlNumber = generateNextControlNumber('ENVI', highestControl, data.dateSampled);

    for (let i = 0; i < total; i++) {
      const sample = data.selectedSamples[i];
      const rowData = { ...data, qty: '1', unit: '1 Swab' };
      await submitSample('ENVI', rowData as unknown as EnviFormData, sample, sharedControlNumber);
    }
  };

  const handleWaterSubmit = async (data: WaterFormData) => {
    const rowData = { ...data, qty: '1', unit: '120 mL' };
    await submitSample('WATER', rowData as WaterFormData, data.waterSource);
  };

  const handleRawMatsSubmit = async (data: RawMatsFormData) => {
    await submitSample('RawMats', data, data.sample);
  };

  const handleAirSubmit = async (data: AirFormData) => {
    const total = data.samplingPoints.length;
    if (total === 0) return;

    // We still call analyseSheetForSubmission via submitSample to grab the blank row or generate one.
    // We'll generate it ONCE manually if we want to share. But Air in sheets might not have pre-created blank rows,
    // wait, Air uses "AIR" format. If it's online, `submitSample` handles the logic. 
    // To ensure they ALL share the same control number, we should fetch it once here.
    let sharedControlNumber: string;

    if (isOnline) {
      const { incompleteControlNumber, highestControlNumber } = await analyseSheetForSubmission('AIR', getSheetTabName('AIR'));
      sharedControlNumber = incompleteControlNumber || generateNextControlNumber('AIR', highestControlNumber, data.dateSampled);
    } else {
      const highestControl = await getHighestControlNumberForSubmission('AIR', data.dateSampled, isOnline);
      sharedControlNumber = generateNextControlNumber('AIR', highestControl, data.dateSampled);
    }

    for (let i = 0; i < total; i++) {
      const point = data.samplingPoints[i];
      const name = `${data.method} - ${point}`;
      // Clone data and inject the specific sampling point so the mapper picks it up
      const rowData = { ...data, samplingPoint: point };
      await submitSample('AIR', rowData, name, sharedControlNumber);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header theme={theme} onSetTheme={setTheme} title="New Sample" />
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        <AnimatePresence mode="wait">
          {!selectedType ? (
            <motion.div
              key="selector"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.3, type: "spring", bounce: 0.2 }}
            >
              <SampleTypeSelector onSelect={setSelectedType} />
            </motion.div>
          ) : selectedType === 'ENVI' ? (
            <motion.div
              key="envi"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, type: "spring", bounce: 0.2 }}
            >
              <EnviForm onSubmit={handleEnviSubmit} onBack={() => setSelectedType(null)} />
            </motion.div>
          ) : selectedType === 'WATER' ? (
            <motion.div
              key="water"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, type: "spring", bounce: 0.2 }}
            >
              <WaterForm onSubmit={handleWaterSubmit} onBack={() => setSelectedType(null)} />
            </motion.div>
          ) : selectedType === 'RawMats' ? (
            <motion.div
              key="rawmats"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, type: "spring", bounce: 0.2 }}
            >
              <RawMatsForm onSubmit={handleRawMatsSubmit} onBack={() => setSelectedType(null)} />
            </motion.div>
          ) : (
            <motion.div
              key="air"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, type: "spring", bounce: 0.2 }}
            >
              <AirForm onSubmit={handleAirSubmit} onBack={() => setSelectedType(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}



