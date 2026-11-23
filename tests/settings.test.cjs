const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const legacyId = '1-pGOoxmZw4qCfK3KnjeRvbK_VbfEAZJUn7GjI01hkXc';
const settingsKey = 'sample_logger_settings';

function loadModule(file, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    console,
    ...globals,
  }, { filename: file });
  return exports;
}

const constants = loadModule('src/data/constants.ts', {});

function createEnvironment(settings, rejectWrites = false) {
  const storage = new Map();
  if (settings !== undefined) storage.set(settingsKey, JSON.stringify(settings));
  let snapshotListener;
  const cloudWrites = [];
  const auth = loadModule('src/utils/auth.ts', {
    '../data/constants': constants,
    './firebase': { db: {}, auth: {} },
    'firebase/auth': {},
    'firebase/firestore': {
      doc: () => ({}),
      setDoc: async (_, data) => { cloudWrites.push(data); },
      onSnapshot: (_, listener) => { snapshotListener = listener; return () => {}; },
    },
  }, {
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => {
        if (rejectWrites) throw new Error('Storage unavailable');
        storage.set(key, value);
      },
    },
  });
  return {
    auth,
    saved: () => JSON.parse(storage.get(settingsKey)),
    cloudWrites,
    emitPreference: spreadsheetId => snapshotListener({
      exists: () => true,
      data: () => ({ spreadsheetId }),
    }),
  };
}

test('migrates the retired official sheet and preserves other saved settings', () => {
  const env = createEnvironment({ spreadsheetId: legacyId, theme: 'dark', extra: 'keep' });
  assert.equal(env.auth.getSettings().spreadsheetId, constants.SPREADSHEETS.official);
  assert.equal(env.saved().theme, 'dark');
  assert.equal(env.saved().extra, 'keep');
  assert.equal(env.saved().spreadsheetId, constants.SPREADSHEETS.official);
});

test('preserves practice, custom, and current official sheet selections', () => {
  for (const id of [constants.SPREADSHEETS.practice, 'custom-workbook', constants.SPREADSHEETS.official]) {
    assert.equal(createEnvironment({ spreadsheetId: id }).auth.getSettings().spreadsheetId, id);
  }
});

test('uses the current official sheet on a fresh installation', () => {
  assert.equal(createEnvironment().auth.getSettings().spreadsheetId, constants.SPREADSHEETS.official);
});

test('uses the migrated setting even when browser storage cannot be written', () => {
  const env = createEnvironment({ spreadsheetId: legacyId }, true);
  assert.equal(env.auth.getSettings().spreadsheetId, constants.SPREADSHEETS.official);
});

test('normalizes a retired sheet ID when saving settings', () => {
  const env = createEnvironment();
  env.auth.saveSettings({ spreadsheetId: legacyId });
  assert.equal(env.saved().spreadsheetId, constants.SPREADSHEETS.official);
});

test('normalizes cloud preference writes and local saved preferences', async () => {
  const env = createEnvironment();
  await env.auth.saveSheetPreference(legacyId);
  assert.equal(env.cloudWrites[0].spreadsheetId, constants.SPREADSHEETS.official);
  assert.equal(env.saved().spreadsheetId, constants.SPREADSHEETS.official);
});

test('a stale cloud preference cannot reintroduce the retired sheet ID', () => {
  const env = createEnvironment({ spreadsheetId: 'custom-workbook' });
  let resolvedId;
  env.auth.listenToSheetPreference(id => { resolvedId = id; });
  env.emitPreference(legacyId);
  assert.equal(resolvedId, constants.SPREADSHEETS.official);
  assert.equal(env.saved().spreadsheetId, constants.SPREADSHEETS.official);
});

const payloadMapping = loadModule('src/utils/sheetPayload.ts', {});
const overrides = [
  { header: 'REMARKS', source: 'skip', value: '' },
  { header: 'QA NOTES', source: 'remarks', match: 'revieew', value: 'review' },
  { header: 'PROGRAM', source: 'fixed', value: '=formula-looking text' },
];

function mockSheetsSubmit() {
  const headers = ['CONTROL #', 'SAMPLE', 'REMARKS', 'QA NOTES', 'PROGRAM'];
  const writes = [];
  const handler = loadModule('api/submit.ts', {
    '../src/utils/sheetPayload.js': payloadMapping,
    './_supabase.js': { supabase: null },
    './_sheets.js': { getSheetsClient: async () => ({ spreadsheets: { values: {
      get: async ({ range }) => ({ data: { values: range.endsWith('1:5') ? [headers] : [
        headers,
        ['E26-001', 'Akash 1 Nozzle 1', 'keep me'],
        ['E26-002', 'Occupied'],
        ['E26-003', ''],
      ] } }),
      batchUpdate: async ({ requestBody }) => { writes.push(requestBody); return { data: {} }; },
    } } }) },
  }, { console: { log() {}, error() {} } }).default;
  return {
    writes,
    async submit(body) {
      const result = {};
      await handler({ method: 'POST', body }, {
        setHeader() {},
        status(code) { result.status = code; return this; },
        json(value) { result.body = value; },
      });
      return result;
    },
  };
}

const loggerItem = {
  sampleLogger: true, sampleType: 'ENVI', controlNumber: 'E26-001',
  sample: 'Akash 1 Nozzle 1', remarks: 'revieew', spreadsheetId: 'practice', sheetTab: 'SWAB 2026',
};

test('sheet payload overrides move, omit, and correct fields in single and bulk submissions', async () => {
  const sheets = mockSheetsSubmit();
  assert.equal((await sheets.submit({ ...loggerItem, sheetOverrides: overrides })).status, 200);
  assert.equal((await sheets.submit({
    bulk: true, items: [loggerItem, { ...loggerItem, sample: 'Akash 1 Nozzle 2' }], sheetOverrides: overrides,
  })).status, 200);
  const [single, bulk] = JSON.parse(JSON.stringify(sheets.writes));
  assert.deepEqual(single.data, [bulk.data[0]]);
  assert.deepEqual(bulk.data, [
    { range: "'SWAB 2026'!A2:E2", values: [['E26-001', 'Akash 1 Nozzle 1', null, "'review", "'=formula-looking text"]] },
    { range: "'SWAB 2026'!A5:E5", values: [['E26-001', 'Akash 1 Nozzle 2', null, "'review", "'=formula-looking text"]] },
  ]);
});

test('stale or protected destinations fail before updating Google Sheets', async () => {
  const sheets = mockSheetsSubmit();
  for (const header of ['OLD HEADER', 'CONTROL #', 'SAMPLE']) {
    assert.equal((await sheets.submit({
      ...loggerItem, sheetOverrides: [{ header, source: 'skip', value: '' }],
    })).status, 422);
  }
  assert.equal(sheets.writes.length, 0);
});

test('retry and bulk requests use overrides for their original workbook and preserve the old payload format', async () => {
  const requests = [];
  const api = loadModule('src/utils/api.ts', {
    './auth': { getSettings: () => ({
      spreadsheetId: 'official', sheetPayloadOverrides: { practice: { ENVI: overrides } },
    }) },
    './db': {},
    './sheetMapping': {},
  }, {
    fetch: async (_, options) => {
      requests.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ success: true }) };
    },
  });
  await api.sendToWebhook('envi', loggerItem);
  await api.sendToWebhookBulk('envi', [loggerItem]);
  await api.sendToWebhook('envi', { 'CONTROL #': 'E26-001', SAMPLE: 'Old queued sample' });
  assert.deepEqual(requests[0].sheetOverrides, overrides);
  assert.equal(requests[0].spreadsheetId, 'practice');
  assert.deepEqual(requests[1].sheetOverrides, overrides);
  assert.equal(requests[1].items[0].spreadsheetId, 'practice');
  assert.deepEqual(requests[2], { 'CONTROL #': 'E26-001', SAMPLE: 'Old queued sample', spreadsheetId: 'official' });
});

test('COP Swabbing lists all 64 equipment-prefixed sample names in order', () => {
  const { ENVI_CATEGORIES, EQUIPMENT_GROUPS } = loadModule('src/data/sampleData.ts', {});
  const category = ENVI_CATEGORIES.find(({ id }) => id === 'COP Swabbing');
  const groups = Array.from(category.equipmentIds, id => EQUIPMENT_GROUPS[id]);
  assert.deepEqual(groups.map(({ label }) => label), ['Akash 1', 'Akash 2', 'Leepack']);
  const points = (label, count) => Array.from({ length: count }, (_, index) => `${label} ${index + 1}`);
  for (const group of groups.slice(0, 2)) {
    assert.deepEqual(Array.from(group.samples), ['Nozzle', 'Flowmeter', 'Cutoff Hose'].flatMap(
      part => points(`${group.label} ${part}`, 6),
    ));
  }
  assert.deepEqual(Array.from(groups[2].samples), [
    ...['XXS', 'Small', 'Medium', 'Large'].flatMap(size => points(`Leepack ${size} Nozzle`, 6)),
    ...points('Leepack Cutoff Hose', 4),
  ]);
});
