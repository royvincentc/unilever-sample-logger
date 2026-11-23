import { useEffect, useState } from 'react';
import type { SampleType } from '../../types';
import { getSettings, saveSettings } from '../../utils/auth';
import { fetchSheetSchema } from '../../utils/api';
import { getSheetTabName } from '../../utils/sheetMapping';
import { isIdentityColumn, SHEET_PAYLOAD_FIELDS, sheetColumnLetter, validateSheetOverrides } from '../../utils/sheetPayload';
import type { SheetColumnOverride } from '../../utils/sheetPayload';
import Button from '../ui/Button';
import TextInput from '../ui/TextInput';
import { useToast } from '../ui/Toast';

const types = { ENVI: 'Envi', WATER: 'Water', RawMats: 'Raw materials', AIR: 'Air' };
const selectClass = 'w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-2 text-sm text-[var(--text-primary)]';

export default function SheetPayloadEditor({ spreadsheetId }: { spreadsheetId: string }) {
  const [sampleType, setSampleType] = useState<SampleType>('ENVI');
  const tab = getSheetTabName(sampleType);
  const { showToast } = useToast();
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<SampleType, SheetColumnOverride[]>>>(() =>
    getSettings().sheetPayloadOverrides?.[spreadsheetId] ?? {});
  const rules = drafts[sampleType] ?? [];
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setHeaders(null);
    fetchSheetSchema(tab, spreadsheetId).then(columns => {
      if (active) setHeaders(columns);
    });
    return () => { active = false; };
  }, [tab, spreadsheetId, refresh]);

  const changeType = (type: SampleType) => {
    if (type === sampleType) return;
    setHeaders(null);
    setSampleType(type);
  };

  const setRules = (updated: SheetColumnOverride[]) => {
    setDrafts(current => ({ ...current, [sampleType]: updated }));
  };

  const updateRule = (index: number, changes: Partial<SheetColumnOverride>) => {
    setRules(rules.map((rule, position) => position === index ? { ...rule, ...changes } : rule));
  };

  const save = () => {
    if (!headers?.length) return;
    const error = validateSheetOverrides(rules, headers, sampleType);
    if (error) {
      showToast('error', 'Check payload overrides', error);
      return;
    }
    try {
      const saved = getSettings().sheetPayloadOverrides ?? {};
      saveSettings({ sheetPayloadOverrides: { ...saved, [spreadsheetId]: { ...saved[spreadsheetId], [sampleType]: rules } } });
      showToast('success', 'Google Sheets payload saved');
    } catch {
      showToast('error', 'Could not save payload overrides', 'Check that browser storage is available.');
    }
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm text-[var(--text-primary)]">
        Sample type
        <select className={selectClass} value={sampleType} onChange={event => changeType(event.target.value as SampleType)}>
          {Object.entries(types).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
        </select>
      </label>
      <p className="text-sm text-[var(--text-secondary)]">
        Headers from {tab}. Choose a destination column and a sample field, fixed text, or Skip column.
        To move a field, assign it to the new column and skip its original column.
        Removing an override restores automatic mapping. Save the payload for each sample type you edit.
      </p>
      {headers === null && <p role="status" className="text-sm">Loading sheet columns…</p>}
      {headers?.length === 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <p role="status">Could not load the columns for {tab}.</p>
          <Button size="sm" variant="secondary" onClick={() => setRefresh(current => current + 1)}>Retry</Button>
        </div>
      )}
      {!!headers?.length && rules.map((rule, index) => (
        <fieldset key={index} className="space-y-2 rounded-xl border border-[var(--border-subtle)] p-3">
          <legend className="px-1 text-sm font-semibold">{rule.header || 'New column override'}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              Sheet column
              <select className={selectClass} value={rule.header} onChange={event => updateRule(index, { header: event.target.value })}>
                <option value="">Choose a column</option>
                {rule.header && !headers.includes(rule.header) && <option value={rule.header}>{rule.header} (missing)</option>}
                {headers.map((header, position) => header.trim() && !isIdentityColumn(header) &&
                  headers.indexOf(header) === headers.lastIndexOf(header) && (
                  <option key={header} value={header} disabled={rules.some((other, otherIndex) => otherIndex !== index && other.header === header)}>
                    {sheetColumnLetter(position + 1)} · {header}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Value to send
              <select className={selectClass} value={rule.source} onChange={event => updateRule(index, { source: event.target.value, match: '', value: '' })}>
                <option value="skip">Skip column</option>
                <option value="fixed">Fixed text</option>
                {SHEET_PAYLOAD_FIELDS[sampleType].map(field => (
                  <option key={field} value={field}>{field.replace(/([A-Z])/g, ' $1').replace(/^./, first => first.toUpperCase())}</option>
                ))}
              </select>
            </label>
          </div>
          {rule.source === 'fixed' && <TextInput label="Fixed text" value={rule.value} onChange={value => updateRule(index, { value })} />}
          {rule.source !== 'fixed' && rule.source !== 'skip' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <TextInput label="Correct exact text (optional)" value={rule.match ?? ''} onChange={match => updateRule(index, { match })} />
              {rule.match && <TextInput label="Replacement text" value={rule.value} onChange={value => updateRule(index, { value })} />}
            </div>
          )}
          <Button size="sm" variant="secondary" onClick={() => setRules(rules.filter((_, position) => position !== index))}>
            Remove override
          </Button>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={!headers?.length} onClick={() => setRules([...rules, { header: '', source: 'skip', value: '' }])}>
          Add column override
        </Button>
        <Button size="sm" disabled={!headers?.length} onClick={save}>Save payload</Button>
      </div>
    </div>
  );
}
