import { useEffect, useState } from 'react';
import type { SampleType } from '../../types';
import { getSettings, saveSettings } from '../../utils/auth';
import { fetchSheetSchema } from '../../utils/api';
import { getSheetTabName } from '../../utils/sheetMapping';
import { describeAutomaticColumns, isIdentityColumn, SHEET_PAYLOAD_FIELDS, sheetColumnLetter, validateSheetOverrides } from '../../utils/sheetPayload';
import type { SheetColumnOverride } from '../../utils/sheetPayload';
import Button from '../ui/Button';
import TextInput from '../ui/TextInput';
import { useToast } from '../ui/Toast';

const types = { ENVI: 'Envi', WATER: 'Water', RawMats: 'Raw materials', AIR: 'Air' };
const selectClass = 'w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-2 text-sm text-[var(--text-primary)]';
const fieldLabel = (field: string) => field.replace(/([A-Z])/g, ' $1').replace(/^./, first => first.toUpperCase());

export default function SheetPayloadEditor({ spreadsheetId }: { spreadsheetId: string }) {
  const [sampleType, setSampleType] = useState<SampleType>('ENVI');
  const tab = getSheetTabName(sampleType);
  const { showToast } = useToast();
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<SampleType, SheetColumnOverride[]>>>(() =>
    getSettings().sheetPayloadOverrides?.[spreadsheetId] ?? {});
  const rules = drafts[sampleType] ?? [];
  const [refresh, setRefresh] = useState(0);
  const automatic = headers?.length ? describeAutomaticColumns(sampleType, headers) : {};

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

  const updateColumn = (header: string, rule?: Omit<SheetColumnOverride, 'header'>) => {
    const otherRules = rules.filter(existing => existing.header !== header);
    setRules(rule ? [...otherRules, { ...rule, header }] : otherRules);
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
        Columns are shown in {tab} order. Choose what each column receives, then save the mapping for this sample type.
        To move a field, select it in the destination column and choose “Skip column” in its original column.
      </p>
      {headers === null && <p role="status" className="text-sm">Loading sheet columns…</p>}
      {headers?.length === 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <p role="status">Could not load the columns for {tab}.</p>
          <Button size="sm" variant="secondary" onClick={() => setRefresh(current => current + 1)}>Retry</Button>
        </div>
      )}
      {!!headers?.length && (
        <>
          {rules.filter(rule => headers.filter(header => header === rule.header).length !== 1 || isIdentityColumn(rule.header))
            .map(rule => (
              <div key={rule.header} className="flex flex-wrap items-center gap-2 text-sm">
                <p>“{rule.header}” is no longer an editable column.</p>
                <Button size="sm" variant="secondary" onClick={() => updateColumn(rule.header)}>Remove saved mapping</Button>
              </div>
            ))}
          <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] px-3">
            {headers.map((header, position) => {
              const column = `${sheetColumnLetter(position + 1)} · ${header.trim() ? header : 'Unnamed column'}`;
              const rule = rules.find(existing => existing.header === header);
              const defaultSource = automatic[header];
              const defaultLabel = defaultSource ? fieldLabel(defaultSource) : 'No value';
              const source = rule?.source ?? defaultSource;
              const canCorrect = source && SHEET_PAYLOAD_FIELDS[sampleType].includes(source);
              const locked = !header.trim() || isIdentityColumn(header) || headers.indexOf(header) !== headers.lastIndexOf(header);
              return (
                <div key={position} className="grid gap-2 py-3 text-sm sm:grid-cols-2">
                  <span className="font-medium">{column}</span>
                  {locked ? (
                    <span className="text-[var(--text-secondary)]">
                      {defaultLabel} {isIdentityColumn(header) ? '· Used to match rows' : '· Requires a unique header'}
                    </span>
                  ) : (
                    <div className="space-y-2">
                      <select aria-label={`Value sent to ${column}`} className={selectClass} value={rule?.source ?? 'automatic'}
                        onChange={event => {
                          const next = event.target.value;
                          updateColumn(header, next === 'automatic' ? undefined : { source: next, value: '' });
                        }}>
                        <option value="automatic">Automatic · {defaultLabel}</option>
                        <option value="skip">Skip column</option>
                        <option value="fixed">Fixed text</option>
                        {SHEET_PAYLOAD_FIELDS[sampleType].map(field => <option key={field} value={field}>{fieldLabel(field)}</option>)}
                      </select>
                      {source === 'fixed' && rule && (
                        <TextInput label="Text to send" value={rule.value} onChange={value => updateColumn(header, { ...rule, value })} />
                      )}
                      {canCorrect && (
                        <details className="space-y-2">
                          <summary className="cursor-pointer text-[var(--text-secondary)]">
                            {rule?.match ? `Replace “${rule.match}” with ${rule.value ? `“${rule.value}”` : 'a blank value'}` : 'Correct a spelling or replace text'}
                          </summary>
                          <TextInput label="Match this exact text" value={rule?.match ?? ''}
                            onChange={match => updateColumn(header, { source, match, value: rule?.value ?? '' })} />
                          <TextInput label="Send this text instead" value={rule?.value ?? ''}
                            onChange={value => updateColumn(header, { source, match: rule?.match, value })} />
                        </details>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Button size="sm" onClick={save}>Save payload</Button>
        </>
      )}
    </div>
  );
}
