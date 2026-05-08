import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '../components/Layout/Header';
import SampleTypeSelector from '../components/forms/SampleTypeSelector';
import EnviForm from '../components/forms/EnviForm';
import WaterForm from '../components/forms/WaterForm';
import RawMatsForm from '../components/forms/RawMatsForm';
import { useToast } from '../components/ui/Toast';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { sendToWebhook } from '../utils/api';
import { generateNextControlNumber } from '../utils/controlNumber';
import { getSheetTabName } from '../utils/sheetMapping';
import { addToQueue, addToHistory } from '../utils/db';
import { getUserName } from '../utils/auth';
import type { SampleType, EnviFormData, WaterFormData, RawMatsFormData, QueueItem, HistoryEntry } from '../types';

interface NewSampleProps {
  theme: 'light' | 'dark' | 'system';
  onSetTheme: (theme: 'light' | 'dark' | 'system') => void;
  onQueueUpdate: () => void;
}

export default function NewSample({ theme, onSetTheme, onQueueUpdate }: NewSampleProps) {
  const [searchParams] = useSearchParams();
  const [selectedType, setSelectedType] = useState<SampleType | null>(null);
  const { showToast } = useToast();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const type = searchParams.get('type') as SampleType | null;
    if (type && ['ENVI', 'WATER', 'RawMats'].includes(type)) {
      setSelectedType(type);
    }
  }, [searchParams]);

  const makeQueueItem = (sampleType: SampleType, formData: EnviFormData | WaterFormData | RawMatsFormData): QueueItem => ({
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    sampleType,
    formData,
    status: 'queued',
    createdAt: new Date().toISOString(),
  });

  const submitSample = async (
    sampleType: SampleType,
    formData: EnviFormData | WaterFormData | RawMatsFormData,
    sampleName: string
  ) => {
    const controlNumber = generateNextControlNumber(sampleType, null, formData.dateSampled);
    const sheetTab = getSheetTabName(formData.dateSampled, sampleType);
    const endpoint = sampleType === 'ENVI' ? 'envi' : sampleType === 'WATER' ? 'water' : 'rawmats';

    const payload = {
      ...formData,
      controlNumber,
      sheetTab,
      sampleType,
    };

    if (!isOnline) {
      const queueItem = makeQueueItem(sampleType, formData);
      queueItem.controlNumber = controlNumber;
      await addToQueue(queueItem);
      onQueueUpdate();
      showToast('info', 'Queued', 'You\'re offline — submission queued for later');
      return;
    }

    const result = await sendToWebhook(endpoint, payload as unknown as Record<string, unknown>);
    
    // Check if webhook returned a raw n8n expression instead of the evaluated control number
    const finalControlNumber = (result.controlNumber && !result.controlNumber.includes('{{')) 
      ? result.controlNumber 
      : controlNumber;

    if (result.success) {
      const historyEntry: HistoryEntry = {
        id: `${finalControlNumber}${sampleName}`,
        sampleType,
        controlNumber: finalControlNumber,
        sampleName,
        dateSampled: formData.dateSampled,
        dateAnalyzed: (formData as any).dateAnalyzed,
        rawMatsType: (formData as any).type,
        status: (formData as any).status || 'ONGOING',
        submittedAt: new Date().toISOString(),
        submittedBy: getUserName(),
      };
      await addToHistory(historyEntry);
      showToast('success', 'Submitted!', `Control #: ${finalControlNumber}`);
      setSelectedType(null);
    } else {
      const queueItem = makeQueueItem(sampleType, formData);
      queueItem.status = 'failed';
      queueItem.errorMessage = result.error;
      queueItem.controlNumber = controlNumber;
      await addToQueue(queueItem);
      onQueueUpdate();
      showToast('error', 'Submission Failed', result.error || 'Moved to queue for retry');
    }
  };

  const handleEnviSubmit = async (data: EnviFormData) => {
    const name = `${data.categories.join(', ')} - ${data.selectedSamples.length} samples`;
    await submitSample('ENVI', data, name);
  };

  const handleWaterSubmit = async (data: WaterFormData) => {
    await submitSample('WATER', data, data.waterSource);
  };

  const handleRawMatsSubmit = async (data: RawMatsFormData) => {
    await submitSample('RawMats', data, data.sample);
  };

  return (
    <div>
      <Header theme={theme} onSetTheme={onSetTheme} title="New Sample" />
      <div className="px-4 lg:px-8 max-w-3xl">
        <AnimatePresence mode="wait">
          {!selectedType ? (
            <motion.div
              key="selector"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <SampleTypeSelector onSelect={setSelectedType} />
            </motion.div>
          ) : selectedType === 'ENVI' ? (
            <motion.div
              key="envi"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <EnviForm onSubmit={handleEnviSubmit} onBack={() => setSelectedType(null)} />
            </motion.div>
          ) : selectedType === 'WATER' ? (
            <motion.div
              key="water"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <WaterForm onSubmit={handleWaterSubmit} onBack={() => setSelectedType(null)} />
            </motion.div>
          ) : (
            <motion.div
              key="rawmats"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <RawMatsForm onSubmit={handleRawMatsSubmit} onBack={() => setSelectedType(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
