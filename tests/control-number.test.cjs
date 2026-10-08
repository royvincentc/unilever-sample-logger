const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/import\.meta\.env/g, '({})');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console, URLSearchParams,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    ...globals,
  }, { filename: file });
  return exports;
}

const mapping = load('src/utils/sheetMapping.ts');
const numbers = load('src/utils/controlNumber.ts', { './sheetMapping': mapping });
const date = '2026-10-08';

test('ENVI continues after 1306 even when incorrect 1299 and 1300 are later in the sheet', () => {
  const highest = numbers.findHighestControlNumber('ENVI', [
    'E26-998', 'E26-1306', '', 'E26-1299', 'E26-1300', 'E25-9999', 'W26-9999',
  ], date);
  assert.equal(highest, 'E26-1306');
  assert.equal(numbers.generateNextControlNumber('ENVI', highest, date), 'E26-1307');
});

test('a new year starts at 001 and malformed controls are ignored', () => {
  const highest = numbers.findHighestControlNumber('ENVI', ['E25-1306', 'E26-invalid', 'E26-1306x'], date);
  assert.equal(highest, null);
  assert.equal(numbers.generateNextControlNumber('ENVI', highest, date), 'E26-001');
});

function apiWithFetch(fetch) {
  return load('src/utils/api.ts', {
    './auth': { getSettings: () => ({ spreadsheetId: 'selected-workbook' }) },
    './db': {}, './sheetMapping': mapping,
  }, { fetch });
}

test('numbering reads the selected Google Sheet directly with caching disabled', async () => {
  const api = apiWithFetch(async (url, options) => {
    const parsed = new URL(url, 'https://example.test');
    assert.equal(parsed.pathname, '/api/sheet-data');
    assert.equal(parsed.searchParams.get('sheetId'), 'selected-workbook');
    assert.equal(parsed.searchParams.get('tab'), 'SWAB 2026');
    assert.equal(parsed.searchParams.get('controlNumbersOnly'), 'true');
    assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => ({ controlNumbers: ['E26-1306'] }) };
  });
  assert.equal((await api.fetchSheetControlNumbers('SWAB 2026'))[0], 'E26-1306');
});

test('failed or invalid numbering reads throw instead of falling back to stale data', async () => {
  for (const response of [
    { ok: false },
    { ok: true, json: async () => [] },
    { ok: true, json: async () => ({ controlNumbers: [null] }) },
  ]) {
    await assert.rejects(apiWithFetch(async () => response).fetchSheetControlNumbers('SWAB 2026'));
  }
});

test('the server includes controls on unnamed rows and merged sample groups', async () => {
  const handler = load('api/sheet-data.ts', {
    './_sheets.js': { getSheetsClient: async () => ({ spreadsheets: { values: {
      get: async () => ({ data: { values: [
        ['Tracker'], ['CONTROL #', 'SAMPLE'], ['E26-1298', 'Old sample'],
        ['E26-1306', 'Inner dome'], ['', 'Outer dome'], ['E26-1308', ''],
        ['E26-1299', 'MV01'],
      ] } }),
    } } }) },
  }).default;
  let result;
  const headers = {};
  const res = {
    setHeader: (name, value) => { headers[name] = value; },
    status(code) { assert.equal(code, 200); return this; },
    json(data) { result = data; },
  };
  await handler({ method: 'GET', query: { sheetId: 'selected-workbook', tab: 'SWAB 2026', controlNumbersOnly: 'true' } }, res);
  assert.deepEqual(Array.from(result.controlNumbers), ['E26-1298', 'E26-1306', 'E26-1308', 'E26-1299']);
  assert.equal(headers['Cache-Control'], 'no-store');
});

test('the ENVI submission lookup bypasses the mirror and propagates read failures', async () => {
  let fail = false;
  const db = load('src/utils/db.ts', {
    idb: {}, './firebase': { db: {} }, 'firebase/firestore': {},
    './sheetMapping': mapping, './controlNumber': numbers,
    './api': {
      fetchLiveSheetData: () => { throw new Error('Must not read the mirror'); },
      fetchSheetControlNumbers: async tab => {
        assert.equal(tab, 'SWAB 2026');
        if (fail) throw new Error('Sheet unavailable');
        return ['E26-1306', 'E26-1299', 'E26-1300'];
      },
    },
  });
  assert.equal(await db.getHighestControlNumberForSubmission('ENVI', date, true), 'E26-1306');
  fail = true;
  await assert.rejects(db.getHighestControlNumberForSubmission('ENVI', date, true), /Sheet unavailable/);
});
