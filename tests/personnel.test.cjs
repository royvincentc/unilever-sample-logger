const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, console, URLSearchParams, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`);
    return dependencies[name];
  }, ...globals });
  return exports;
}
const api = load('api/_personnel.ts');

function sheetFixture({ range = false, missing = false, tables = false, tableOffset = 0 } = {}) {
  const sourceReads = [];
  const gridReads = [];
  const headers = {
    SWAB: { G: 'SWABBED BY', I: 'ANALYZED BY' }, WATER: { G: 'SAMPLED BY', I: 'ANALYZED BY' },
    AIR: { F: 'PERFORMED BY' }, 'RM,FG,SFG': { K: 'RECEIVED BY', M: 'ANALYZED BY' },
  };
  const sheets = { spreadsheets: {
    values: { get: async ({ range: ref }) => {
      if (ref.endsWith('A1:AZ10')) {
        const tab = ref.slice(1, ref.indexOf(' 2026')).toUpperCase();
        const row = [];
        for (const [column, header] of Object.entries(headers[tab])) row[column.charCodeAt(0) - 65] = header;
        return { data: { values: [['Title'], row] } };
      }
      sourceReads.push(ref);
      return { data: { values: [['PF4: J. Santos'], ['NEW'], ['NEW'], ['']] } };
    } },
    get: async ({ ranges, fields }) => {
      if (!ranges) {
        assert.ok(fields.includes('tables('), 'must request table dropdown metadata');
        return { data: { sheets: Object.entries(headers).map(([tab, columns]) => ({
          properties: { title: `${tab === 'AIR' ? 'Air' : tab} 2026` },
          tables: tables ? [{ range: { startColumnIndex: tableOffset }, columnProperties: Object.entries(columns).map(([column, header]) => ({
            columnIndex: column.charCodeAt(0) - 65 - tableOffset,
            dataValidationRule: { condition: { type: 'ONE_OF_LIST', values: [
              { userEnteredValue: ` ${header} current ` }, { userEnteredValue: `${header} current` }, { userEnteredValue: 'JUEN/ALBESA' },
            ] } },
          })) }] : [],
        })) } };
      }
      gridReads.push(...ranges);
      if (missing) return { data: { sheets: [] } };
      return { data: { sheets: [{ data: ranges.map((ref) => ({
      startColumn: ref.split('!')[1].charCodeAt(0) - 65,
      rowData: [{ values: [{ dataValidation: { condition: { type: 'ONE_OF_LIST', values: [{ userEnteredValue: 'REMOVED' }] } } }] },
        { values: [{ dataValidation: missing ? undefined : { condition: range ? {
          type: 'ONE_OF_RANGE', values: [{ userEnteredValue: "='Names'!$A$2:$A" }],
        } : { type: 'ONE_OF_LIST', values: [{ userEnteredValue: ` ${ref} ` }, { userEnteredValue: ` ${ref} ` }, { userEnteredValue: '' }] } } }] }],
    })) }] } };
    },
  } };
  return { sheets, sourceReads, gridReads };
}

test('reads seven distinct dropdowns and excludes removed historical names', async () => {
  const { sheets } = sheetFixture();
  const lists = await api.readPersonnel(sheets, 'sheet', '2026');
  assert.equal(Object.keys(lists).length, 7);
  assert.equal(lists.envi.length, 1);
  assert.notEqual(lists.envi[0], lists.enviAnalyst[0]);
  assert.ok(lists.air[0].includes('Air 2026'));
  assert.ok(lists.rawAnalyst[0].includes('RM,FG,SFG 2026'));
  assert.ok(!Object.values(lists).flat().includes('REMOVED'));
});

test('reads table dropdowns at the supplied columns even without cell validations', async () => {
  const { sheets, gridReads } = sheetFixture({ tables: true, missing: true });
  const lists = await api.readPersonnel(sheets, 'sheet', '2026');
  assert.deepEqual(Array.from(lists.envi), ['SWABBED BY current', 'JUEN/ALBESA']);
  assert.deepEqual(Array.from(lists.enviAnalyst), ['ANALYZED BY current', 'JUEN/ALBESA']);
  assert.deepEqual(gridReads, ["'SWAB 2026'!G:G", "'SWAB 2026'!I:I", "'WATER 2026'!G:G", "'WATER 2026'!I:I", "'Air 2026'!F:F", "'RM,FG,SFG 2026'!K:K", "'RM,FG,SFG 2026'!M:M"]);
  assert.equal(Object.keys(lists).length, 7);
});

test('table column indices are relative to the table and override old cell dropdowns', async () => {
  const { sheets } = sheetFixture({ tables: true, tableOffset: 2 });
  const lists = await api.readPersonnel(sheets, 'sheet', '2026');
  assert.deepEqual(Array.from(lists.rawReceiver), ['RECEIVED BY current', 'JUEN/ALBESA']);
  assert.ok(!Object.values(lists).flat().includes('REMOVED'));
});

test('range dropdowns preserve case, remove duplicates and fetch shared ranges once', async () => {
  const { sheets, sourceReads } = sheetFixture({ range: true });
  const lists = await api.readPersonnel(sheets, 'sheet', '2026');
  assert.deepEqual(Array.from(lists.waterSampler), ['PF4: J. Santos', 'NEW']);
  assert.deepEqual(sourceReads, ["'Names'!$A$2:$A"]);
});

test('missing dropdown definitions reject rather than replacing saved names', async () => {
  const { sheets } = sheetFixture({ missing: true });
  await assert.rejects(api.readPersonnel(sheets, 'sheet', '2026'), /no dropdown names/);
});

function environment() {
  let id = 'practice';
  let now = new Date('2026-10-09T04:00:00Z').getTime();
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const storage = new Map();
  const events = new Map();
  let interval;
  let calls = 0;
  let fail = false;
  let fetchImpl;
  let snapshot;
  const lists = Object.fromEntries(Object.keys(api.PERSONNEL_FIELDS).map(key => [key, [`${key} NEW`]]));
  const hook = load('src/hooks/usePersonnel.ts', {
    react: { useEffect: callback => callback(), useSyncExternalStore: (_, get) => { snapshot = get; return get(); } },
    '../utils/auth': { getSettings: () => ({ spreadsheetId: id }) },
    '../data/personnelData': { PERSONNEL: ['DEFAULT'], PERSONNEL_WITH_MARK: ['MARK'], WATER_SAMPLER_OPTIONS: ['PF4'] },
  }, {
    Date: Clock, navigator: { onLine: true },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    window: { setInterval: callback => { interval = callback; return 1; }, clearInterval: () => {},
      addEventListener: (name, callback) => events.set(name, callback), removeEventListener: name => events.delete(name) },
    fetch: async (...args) => { calls++; if (fetchImpl) return fetchImpl(...args); return { ok: !fail, json: async () => fail ? { error: 'Sheets unavailable' } : { lists } }; },
  });
  hook.usePersonnel();
  return { hook, events, storage, lists, state: () => snapshot(), calls: () => calls,
    tick: () => interval(), advance: ms => { now += ms; }, switch: () => { id = 'official'; },
    fail: () => { fail = true; }, mockFetch: impl => { fetchImpl = impl; } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('automatic refresh uses four-hour TTL; manual sync bypasses it', async () => {
  const env = environment();
  const stop = env.hook.startPersonnelSync();
  await flush();
  assert.equal(env.calls(), 1);
  env.advance(env.hook.PERSONNEL_SYNC_INTERVAL - 1);
  env.tick(); await flush();
  assert.equal(env.calls(), 1);
  env.advance(1); env.tick(); await flush();
  assert.equal(env.calls(), 2);
  await env.hook.syncPersonnel();
  assert.equal(env.calls(), 3);
  stop();
});

test('failed refresh retains names and last successful timestamp', async () => {
  const env = environment();
  await env.hook.syncPersonnel();
  const previous = env.state();
  env.fail(); env.advance(1000);
  await assert.rejects(env.hook.syncPersonnel(), /Sheets unavailable/);
  assert.equal(env.state().lists, previous.lists);
  assert.equal(env.state().syncedAt, previous.syncedAt);
  assert.equal(env.state().syncing, false);
});

test('disabled automatic sync allows manual refresh and caches separately for each spreadsheet', async () => {
  const env = environment();
  env.hook.usePersonnel().setAutoSync(false);
  const stop = env.hook.startPersonnelSync();
  assert.equal(env.calls(), 0);
  await env.hook.syncPersonnel();
  env.switch(); env.tick();
  assert.deepEqual(Array.from(env.state().lists.envi), ['DEFAULT']);
  await env.hook.syncPersonnel();
  assert.equal(env.storage.size, 3);
  assert.equal(env.calls(), 2);
  stop();
});

test('deduplicates simultaneous refresh requests', async () => {
  const env = environment();
  await Promise.all([env.hook.syncPersonnel(), env.hook.syncPersonnel()]);
  assert.equal(env.calls(), 1);
});

test('ignores an old spreadsheet response and refreshes the newly selected source', async () => {
  const env = environment();
  let finish;
  env.mockFetch(() => new Promise(resolve => { finish = resolve; }));
  const first = env.hook.syncPersonnel();
  env.switch();
  const second = env.hook.syncPersonnel();
  env.mockFetch(async () => ({ ok: true, json: async () => ({ lists: env.lists }) }));
  finish({ ok: true, json: async () => ({ lists: env.lists }) });
  await Promise.all([first, second]);
  assert.equal(env.calls(), 2);
  assert.ok(![...env.storage.keys()].some(key => key.includes('practice')));
});
