import PageIntro from '../components/ui/PageIntro';
import PersonnelSync from '../components/ui/PersonnelSync';
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
import { sendToWebhook, sendToWebhookBulk, analyseSheetForSubmission } from '../utils/api';
import { generateNextControlNumber } from '../utils/controlNumber';
import { getSheetTabName } from '../utils/sheetMapping';
import { addToQueue, addToHistory, getHighestControlNumberForSubmission } from '../utils/db';
import { getSettings, getUserName } from '../utils/auth';
import type { SampleType, EnviFormData, WaterFormData, RawMatsFormData, AirFormData, QueueItem, HistoryEntry } from '../types';

import { useTheme } from '../hooks/useTheme';
import { defaultSampleCatalog, validateSampleCatalog, type SampleCatalog } from '../data/sampleCatalog';
import { beginGoogleSignIn, request, RequestError, workspaceId } from '../utils/collaboration/client';

interface NewSampleProps {
  onQueueUpdate: () => void;
}

export default function NewSample({ onQueueUpdate }: NewSampleProps) {
  const { theme, setTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const [selectedType, setSelectedType] = useState<SampleType | null>(null);
  const [catalog, setCatalog] = useState<SampleCatalog>();
  const [catalogNotice, setCatalogNotice] = useState('');
  const [catalogSignIn, setCatalogSignIn] = useState(false);
  const { showToast } = useToast();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    let active = true;
    const workspace = encodeURIComponent(workspaceId());
    const cacheKey = `sample_logger_catalog:${workspace}`;
    request<{ catalog: SampleCatalog }>(`/api/sample-catalog?workspace=${workspace}`).then(result => {
      if (!active) return;
      const error = validateSampleCatalog(result.catalog);
      if (error) throw new Error(error);
      setCatalog(result.catalog);
      try { localStorage.setItem(cacheKey, JSON.stringify(result.catalog)); } catch { /* optional offline cache */ }
    }).catch(error => {
      if (!active) return;
      if (error instanceof RequestError && (error.status === 401 || error.status === 403)) {
        setCatalogSignIn(true);
        setCatalog(defaultSampleCatalog);
        setCatalogNotice('Using default sample choices.');
        return;
      }
      let cached: SampleCatalog | undefined;
      try {
        const value = JSON.parse(localStorage.getItem(cacheKey) ?? 'null');
        if (!validateSampleCatalog(value)) cached = value;
      } catch { /* use bundled choices */ }
      setCatalog(cached ?? defaultSampleCatalog);
      setCatalogNotice(cached ? 'Using the last downloaded sample choices.' : 'Shared sample choices are unavailable. Using defaults.');
    });
    return () => { active = false; };
  }, []);

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
      const { spreadsheetId } = getSettings();
      const subType = sampleType === 'RawMats' ? (formData as RawMatsFormData).type : undefined;
      const sheetTab = getSheetTabName(sampleType, subType, sampleType === 'ENVI' ? new Date(formData.dateSampled) : undefined);
      const endpoint = sampleType === 'ENVI' ? 'envi' : sampleType === 'WATER' ? 'water' : sampleType === 'AIR' ? 'air' : 'rawmats';

      // For WATER, RawMats, and AIR: one sheet read returns both the incomplete row
      // control number AND the highest existing number â€” no double fetch.
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
          // No blank row found â€” generate the next sequential control number
          controlNumber = generateNextControlNumber(sampleType, highestControlNumber, formData.dateSampled);
        }
      } else {
        // ENVI or offline â€” fall back to local DB lookup
        const highestControl = await getHighestControlNumberForSubmission(sampleType, formData.dateSampled, isOnline);
        controlNumber = generateNextControlNumber(sampleType, highestControl, formData.dateSampled);
      }

      const payload: Record<string, unknown> = {
        ...(formData as unknown as Record<string, unknown>),
        sampleLogger: true,
        spreadsheetId,
        controlNumber,
        sheetTab,
        sampleType,
        isUpdate,
        // Ensure sample name is available for mapping
        sample: sampleName,
        // For ENVI, join categories so it's a string, just in case they add a category column
        category: (formData as any).categories ? (formData as any).categories.join(', ') : undefined,
      };

      if (!isOnline) {
        const queueItem = makeQueueItem(sampleType, formData, sampleName);
        queueItem.controlNumber = controlNumber;
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

  
  const submitBulkSamples = async (
    sampleType: SampleType,
    items: { formData: any; sampleName: string }[],
    sharedControlNumber: string
  ) => {
    try {
      const { spreadsheetId } = getSettings();
      if (!isOnline) {
        // Fallback to offline queuing if connection drops during bulk attempt
        for (const item of items) {
          const queueItem = makeQueueItem(sampleType, item.formData, item.sampleName);
          queueItem.controlNumber = sharedControlNumber;
          queueItem.formData = {
            ...(item.formData as any),
            sampleLogger: true,
            spreadsheetId,
            controlNumber: sharedControlNumber,
            sheetTab: getSheetTabName(sampleType, sampleType === 'RawMats' ? (item.formData as any).type : undefined, sampleType === 'ENVI' ? new Date(item.formData.dateSampled) : undefined),
            sampleType,
            isUpdate: false,
            sample: item.sampleName,
            category: (item.formData as any).categories ? (item.formData as any).categories.join(', ') : undefined
          } as any;
          await addToQueue(queueItem);
        }
        onQueueUpdate();
        showToast('info', 'Queued', "You're offline — submission queued for later");
        return;
      }

      const endpoint = sampleType === 'ENVI' ? 'envi' : sampleType === 'AIR' ? 'air' : 'water';
      const sheetTab = getSheetTabName(sampleType, undefined, sampleType === 'ENVI' ? new Date(items[0].formData.dateSampled) : undefined);
      
      const bulkPayloads = items.map(item => ({
        ...(item.formData as unknown as Record<string, unknown>),
        sampleLogger: true,
        spreadsheetId,
        controlNumber: sharedControlNumber,
        sheetTab,
        sampleType,
        isUpdate: false,
        sample: item.sampleName,
        category: (item.formData as any).categories ? (item.formData as any).categories.join(', ') : undefined,
      }));

      const result = await sendToWebhookBulk(endpoint, bulkPayloads);
      
      let finalControlNumber = (result.controlNumber && result.controlNumber !== 'N/A' && !result.controlNumber.includes('{{')) 
        ? result.controlNumber 
        : sharedControlNumber;

      if (sampleType === 'RawMats') {
        finalControlNumber = finalControlNumber.replace(/^RM-?/i, '');
      }

      if (result.success) {
        for (const item of items) {
          const historyEntry = {
            id: `${finalControlNumber}-${item.sampleName}-${Date.now()}-${Math.random()}`,
            sampleType,
            controlNumber: finalControlNumber,
            sampleName: item.sampleName,
            dateSampled: item.formData.dateSampled,
            dateAnalyzed: item.formData.dateAnalyzed || item.formData.dateSampled,
            rawMatsType: item.formData.type || null,
            status: item.formData.status || 'ON GOING',
            submittedAt: new Date().toISOString(),
            submittedBy: getUserName(),
          };
          await addToHistory(historyEntry);
        }
        showToast('success', 'Submitted Bulk!', `Control #: ${finalControlNumber}`);
        setSelectedType(null);
        if (onQueueUpdate) onQueueUpdate();
      } else {
        // Enqueue them as failed
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const queueItem = makeQueueItem(sampleType, item.formData, item.sampleName);
          queueItem.status = 'failed';
          queueItem.errorMessage = result.error;
          queueItem.controlNumber = sharedControlNumber;
          queueItem.formData = bulkPayloads[i] as any;
          await addToQueue(queueItem);
        }
        onQueueUpdate();
        showToast('error', 'Bulk Submission Failed', result.error || 'Moved to queue for retry');
      }
    } catch (error) {
      console.error('Bulk submission error:', error);
      showToast('error', 'Error', error instanceof Error ? error.message : 'An unexpected error occurred during submission');
    }
  };

  const handleEnviSubmit = async (data: EnviFormData) => {
    const total = data.selectedSamples.length;
    if (total === 0) return;

    let highestControl: string | null;
    try {
      highestControl = await getHighestControlNumberForSubmission('ENVI', data.dateSampled, isOnline);
    } catch (error) {
      showToast('error', 'Control number lookup failed', error instanceof Error ? error.message : 'Please retry.');
      return;
    }
    const sharedControlNumber = generateNextControlNumber('ENVI', highestControl, data.dateSampled);

    if (isOnline) {
      const items = data.selectedSamples.map(sample => ({
        formData: { ...data, qty: '1', unit: '1 Swab' },
        sampleName: sample
      }));
      await submitBulkSamples('ENVI', items, sharedControlNumber);
    } else {
      for (let i = 0; i < total; i++) {
        const sample = data.selectedSamples[i];
        const rowData = { ...data, qty: '1', unit: '1 Swab' };
        await submitSample('ENVI', rowData as unknown as EnviFormData, sample, sharedControlNumber);
        if (i < total - 1) await new Promise(r => setTimeout(r, 1200));
      }
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

    let sharedControlNumber: string;

    if (isOnline) {
      const { incompleteControlNumber, highestControlNumber } = await analyseSheetForSubmission('AIR', getSheetTabName('AIR'));
      sharedControlNumber = incompleteControlNumber || generateNextControlNumber('AIR', highestControlNumber, data.dateSampled);
      
      const items = data.samplingPoints.map(point => ({
        formData: { ...data, samplingPoint: point },
        sampleName: `${data.method} - ${point}`
      }));
      await submitBulkSamples('AIR', items, sharedControlNumber);
    } else {
      const highestControl = await getHighestControlNumberForSubmission('AIR', data.dateSampled, isOnline);
      sharedControlNumber = generateNextControlNumber('AIR', highestControl, data.dateSampled);

      for (let i = 0; i < total; i++) {
        const point = data.samplingPoints[i];
        const name = `${data.method} - ${point}`;
        const rowData = { ...data, samplingPoint: point };
        await submitSample('AIR', rowData, name, sharedControlNumber);
        if (i < total - 1) await new Promise(r => setTimeout(r, 1200));
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header theme={theme} onSetTheme={setTheme} title="New Sample" />
      <div className="lab-page-content flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        <PageIntro title="Log a new sample" description="Choose a sample type. Your existing lab fields and submission workflow are ready." kind="envi" />
        <PersonnelSync />
        {catalogNotice && <p role="status" className="my-3 text-sm text-[var(--text-secondary)]">
          {catalogNotice}{' '}
          {catalogSignIn && <button type="button" className="underline" onClick={() => beginGoogleSignIn()}>
            Sign in with Google for workspace choices
          </button>}
        </p>}
        <AnimatePresence mode="wait">
          {!selectedType ? (
            <motion.div
              key="selector"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <SampleTypeSelector onSelect={setSelectedType} />
            </motion.div>
          ) : !catalog ? (
            <p key="catalog-loading" role="status">Loading sample choices…</p>
          ) : selectedType === 'ENVI' ? (
            <motion.div
              key="envi"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <EnviForm catalog={catalog.envi} onSubmit={handleEnviSubmit} onBack={() => setSelectedType(null)} />
            </motion.div>
          ) : selectedType === 'WATER' ? (
            <motion.div
              key="water"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <WaterForm sources={catalog.waterSources} onSubmit={handleWaterSubmit} onBack={() => setSelectedType(null)} />
            </motion.div>
          ) : selectedType === 'RawMats' ? (
            <motion.div
              key="rawmats"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <RawMatsForm catalog={catalog} onSubmit={handleRawMatsSubmit} onBack={() => setSelectedType(null)} />
            </motion.div>
          ) : (
            <motion.div
              key="air"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <AirForm catalog={catalog} onSubmit={handleAirSubmit} onBack={() => setSelectedType(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
