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
