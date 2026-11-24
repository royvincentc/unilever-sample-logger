import { useEffect, useState } from 'react';
import { catalogLists, validateSampleCatalog, type CatalogList, type SampleCatalog } from '../../data/sampleCatalog';
import type { SampleType } from '../../types';
import type { Workspace } from '../../types/collaboration';
import { request } from '../../utils/collaboration/client';
import WorkspaceGate from '../collaboration/WorkspaceGate';
import Button from '../ui/Button';
import TextInput from '../ui/TextInput';

const sections: Record<SampleType, { label: string; lists: CatalogList[] }> = {
  ENVI: { label: 'Envi', lists: [] },
  RawMats: { label: 'RM / SFG / FG', lists: ['rawSamples', 'rawSources', 'rfaf'] },
  WATER: { label: 'Water', lists: ['waterSources'] },
  AIR: { label: 'Air', lists: ['airMethods', 'airPoints'] },
};

function OrderedList({ label, values, onChange }: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <textarea className="w-full" rows={Math.max(3, Math.min(values.length, 10))} value={values.join('\n')}
        onChange={event => onChange(event.target.value.split('\n'))} />
    </label>
  );
}

function orderActions<Item>(items: Item[], index: number, onChange: (items: Item[]) => void) {
  const move = (offset: number) => {
    const updated = [...items];
    [updated[index], updated[index + offset]] = [updated[index + offset], updated[index]];
    onChange(updated);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" disabled={index === 0} onClick={() => move(-1)}>Move up</Button>
      <Button size="sm" variant="secondary" disabled={index === items.length - 1} onClick={() => move(1)}>Move down</Button>
      <Button size="sm" variant="secondary" onClick={() => onChange(items.filter((_, position) => position !== index))}>Remove</Button>
    </div>
  );
}

function Editor({ workspace }: { workspace: Workspace }) {
  const [type, setType] = useState<SampleType>('ENVI');
  const [draft, setDraft] = useState<SampleCatalog>();
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const endpoint = `/api/sample-catalog?workspace=${encodeURIComponent(workspace.id)}`;

  useEffect(() => {
    let active = true;
    request<{ catalog: SampleCatalog; revision: number }>(endpoint).then(result => {
      if (!active) return;
      setDraft(result.catalog);
      setRevision(result.revision);
      setMessage('');
    }).catch(error => {
      if (active) setMessage(error.message);
    });
    return () => { active = false; };
  }, [endpoint, attempt]);

  if (!draft) return (
    <div className="space-y-2">
      <p role="status">{message || 'Loading sample choices…'}</p>
      {message && <Button size="sm" variant="secondary" onClick={() => { setMessage(''); setAttempt(attempt + 1); }}>Retry</Button>}
    </div>
  );

  const setCategories = (envi: SampleCatalog['envi']) => setDraft({ ...draft, envi });
  const clean = (values: string[]) => values.map(value => value.trim()).filter(Boolean);
  const save = async () => {
    const catalog = {
      ...draft,
      envi: draft.envi.map(category => ({
        ...category, label: category.label.trim(),
        groups: category.groups.map(group => ({ ...group, label: group.label.trim(), samples: clean(group.samples) })),
      })),
    };
    for (const key of Object.keys(catalogLists) as CatalogList[]) catalog[key] = clean(catalog[key]);
    const error = validateSampleCatalog(catalog);
    if (error) { setMessage(error); return; }
    setSaving(true);
    setMessage('');
    try {
      const result = await request<{ revision: number }>(endpoint, { catalog, revision });
      setDraft(catalog);
      setRevision(result.revision);
      setMessage('Sample Logger choices saved for this workspace.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <fieldset disabled={saving} className="space-y-4">
      <label className="block text-sm font-medium">
        Sample type
        <select className="w-full" value={type} onChange={event => setType(event.target.value as SampleType)}>
          {Object.entries(sections).map(([value, section]) => <option key={value} value={value}>{section.label}</option>)}
        </select>
      </label>
      <p className="text-sm text-[var(--text-secondary)]">
        Enter one choice per line in the order you want it shown. Choice text is sent to Google Sheets when selected.
      </p>
      {sections[type].lists.map(key => (
        <OrderedList key={key} label={catalogLists[key]} values={draft[key]} onChange={values => setDraft({ ...draft, [key]: values })} />
      ))}
      {type === 'ENVI' && <>
        {draft.envi.map((category, categoryIndex) => {
          const updateCategory = (changes: Partial<typeof category>) =>
            setCategories(draft.envi.map(item => item.id === category.id ? { ...item, ...changes } : item));
          const setGroups = (groups: typeof category.groups) => updateCategory({ groups });
          return (
            <details key={category.id} className="space-y-3 rounded-xl border border-[var(--border-subtle)] p-3">
              <summary className="cursor-pointer font-medium">{category.label || 'New category'}</summary>
              <TextInput label="Category name" value={category.label} onChange={label => updateCategory({ label })} />
              {orderActions(draft.envi, categoryIndex, setCategories)}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={category.custom} onChange={event => updateCategory({ custom: event.target.checked })} />
                Allow custom swab points
              </label>
              {category.groups.map((group, groupIndex) => {
                const updateGroup = (changes: Partial<typeof group>) =>
                  setGroups(category.groups.map(item => item.id === group.id ? { ...item, ...changes } : item));
                return (
                  <details key={group.id} className="space-y-3 rounded-xl border border-[var(--border-subtle)] p-3">
                    <summary className="cursor-pointer">{group.label || 'New group'} · {group.samples.filter(Boolean).length} samples</summary>
                    <TextInput label="Group name" value={group.label} onChange={label => updateGroup({ label })} />
                    {orderActions(category.groups, groupIndex, setGroups)}
                    <OrderedList label="Samples" values={group.samples} onChange={samples => updateGroup({ samples })} />
                  </details>
                );
              })}
              <Button size="sm" variant="secondary" onClick={() => setGroups([...category.groups, {
                id: crypto.randomUUID(), label: '', samples: [],
              }])}>Add group</Button>
            </details>
          );
        })}
        <Button size="sm" variant="secondary" onClick={() => setCategories([...draft.envi, {
          id: crypto.randomUUID(), label: '', groups: [], custom: false,
        }])}>Add category</Button>
      </>}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" loading={saving} onClick={() => void save()}>Save sample choices</Button>
        <span role="status" className="text-sm">{message}</span>
      </div>
    </fieldset>
  );
}

export default function SampleCatalogEditor() {
  return <WorkspaceGate>{workspace => workspace.role === 'admin'
    ? <Editor key={workspace.id} workspace={workspace} />
    : <p className="text-sm">A workspace admin can edit sample choices.</p>}
  </WorkspaceGate>;
}
