const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
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
const summary = load('src/utils/shiftSummary.ts');
function apiWith(fetch, overrides = {}) {
  return load('src/utils/api.ts', {
    './auth': { getSettings: () => ({ spreadsheetId: 'private-workbook' }) },
    './db': {},
    './sheetMapping': mapping,
    './shiftSummary': summary,
    ...overrides,
  }, { fetch });
}

test('summary reads all three live tabs concurrently with no caching', async () => {
  const calls = [];
  const releases = [];
  const api = apiWith((url, options) => {
    const parsed = new URL(url, 'https://example.test');
    assert.equal(parsed.pathname, '/api/sheet-data');
    assert.equal(parsed.searchParams.get('sheetId'), 'private-workbook');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.method || 'GET', 'GET');
    calls.push(parsed.searchParams.get('tab'));
    return new Promise(resolve => releases.push(() => resolve({
      ok: true, json: async () => [{ tab: parsed.searchParams.get('tab') }],
    })));
  });
  const pending = api.fetchShiftSummaryRows('2026-11-05', 'AM');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['SWAB 2026', 'WATER 2026', 'RM,FG,SFG 2026']);
  releases.forEach(release => release());
  const result = await pending;
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    ENVI: [{ tab: 'SWAB 2026' }],
    WATER: [{ tab: 'WATER 2026' }],
    RawMats: [{ tab: 'RM,FG,SFG 2026' }],
  });
});

test('overnight New Year reads both years concurrently and merges each type', async () => {
  const calls = [];
  const releases = [];
  const api = apiWith(url => {
    const tab = new URL(url, 'https://example.test').searchParams.get('tab');
    calls.push(tab);
    return new Promise(resolve => releases.push(() => resolve({
      ok: true, json: async () => [{ tab }],
    })));
  });
  const pending = api.fetchShiftSummaryRows('2026-12-31', 'PM');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 6);
  releases.forEach(release => release());
  const result = await pending;
  for (const [type, prefix] of [['ENVI', 'SWAB'], ['WATER', 'WATER'], ['RawMats', 'RM,FG,SFG']]) {
    assert.deepEqual(Array.from(result[type], row => row.tab), [`${prefix} 2026`, `${prefix} 2027`]);
  }
});

test('Taipei year and exclusive end determine tabs regardless of host timezone', async () => {
  for (const [start, end, year] of [
    ['2026-12-31T16:00:00Z', '2027-01-01T04:00:00Z', '2027'],
    ['2026-12-31T04:00:00Z', '2026-12-31T16:00:00Z', '2026'],
  ]) {
    const tabs = [];
    const api = apiWith(async url => {
      tabs.push(new URL(url, 'https://example.test').searchParams.get('tab'));
      return { ok: true, json: async () => [] };
    }, {
      './shiftSummary': { getShiftWindow: () => ({ start: new Date(start), end: new Date(end) }) },
    });
    await api.fetchShiftSummaryRows('2026-12-31', 'PM');
    assert.deepEqual(tabs, [`SWAB ${year}`, `WATER ${year}`, `RM,FG,SFG ${year}`]);
  }
});

test('missing spreadsheet settings rejects before any request', async () => {
  const api = apiWith(() => assert.fail('unexpected request'), {
    './auth': { getSettings: () => ({}) },
  });
  await assert.rejects(api.fetchShiftSummaryRows('2026-11-05', 'AM'), /Spreadsheet ID/);
});

test('AM overtime reads next-year tabs only when preview reaches that year', async () => {
  for (const [now, years] of [
    ['2026-12-31T20:00:00+08:00', ['2026']],
    ['2027-01-01T00:00:00+08:00', ['2026', '2027']],
    ['2028-01-01T08:00:00+08:00', ['2026', '2027']],
  ]) {
    const tabs = [];
    const api = apiWith(async url => {
      const tab = new URL(url, 'https://example.test').searchParams.get('tab');
      tabs.push(tab);
      return { ok: true, json: async () => [{ tab }] };
    });
    const result = await api.fetchShiftSummaryRows('2026-12-31', 'AM', new Date(now));
    assert.deepEqual(tabs, ['SWAB', 'WATER', 'RM,FG,SFG'].flatMap(prefix => years.map(year => `${prefix} ${year}`)));
    assert.deepEqual(Array.from(result.WATER, row => row.tab), years.map(year => `WATER ${year}`));
  }
});

test('any failed or malformed tab rejects the entire report without leaking details', async () => {
  for (const response of [
    { ok: false },
    { ok: true, json: async () => null },
    { ok: true, json: async () => ({ error: 'private-workbook' }) },
    ...[null, [], 'row', 1, false].map(row => ({ ok: true, json: async () => [row] })),
    { ok: true, json: async () => { throw new Error('private-workbook'); } },
    new Error('private-workbook'),
  ]) {
    const api = apiWith(async url => {
      if (!url.includes('WATER')) return { ok: true, json: async () => [] };
      if (response instanceof Error) throw response;
      return response;
    });
    await assert.rejects(api.fetchShiftSummaryRows('2026-11-05', 'AM'), error => {
      assert.match(error.message, /WATER 2026/);
      assert.doesNotMatch(error.message, /private-workbook/);
      return true;
    });
  }
});

test('a failed next-year tab also rejects the entire report', async () => {
  const api = apiWith(async url => ({
    ok: !url.includes('2027'), json: async () => [],
  }));
  await assert.rejects(api.fetchShiftSummaryRows('2026-12-31', 'PM'), /2027/);
});

test('Telegram rejects blank input without posting', async () => {
  const api = apiWith(() => assert.fail('unexpected request'));
  await assert.rejects(api.sendShiftSummaryToTelegram(' \n\t '), /blank|empty/i);
});

test('Telegram posts helper chunks sequentially and preserves all text', async () => {
  const bodies = [];
  let release;
  const text = 'a'.repeat(4000) + '\nlast';
  const api = apiWith(async (url, options) => {
    assert.equal(url, '/api/telegram');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/json');
    bodies.push(JSON.parse(options.body).text);
    if (bodies.length === 1) await new Promise(resolve => { release = resolve; });
    return { ok: true, json: async () => ({ success: true }) };
  });
  const pending = api.sendShiftSummaryToTelegram(text);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(bodies.length, 1);
  release();
  await pending;
  assert.deepEqual(bodies, ['a'.repeat(4000), '\nlast']);
  assert.equal(bodies.join(''), text);
});

test('Telegram stops on every failure kind and reports prior successful sends', async () => {
  for (const sent of [0, 1]) {
    for (const failure of [
      { ok: false },
      { ok: true, json: async () => ({ success: false }) },
      { ok: true, json: async () => null },
      { ok: true, json: async () => { throw new Error('secret'); } },
      new Error('secret'),
    ]) {
      let calls = 0;
      const api = apiWith(async () => {
        calls++;
        if (calls <= sent) return { ok: true, json: async () => ({ success: true }) };
        if (failure instanceof Error) throw failure;
        return failure;
      });
      await assert.rejects(api.sendShiftSummaryToTelegram('x'.repeat(9000)), error => {
        assert.match(error.message, new RegExp(`${sent} (?:prior )?messages? already sent`, 'i'));
        assert.doesNotMatch(error.message, /secret/);
        return true;
      });
      assert.equal(calls, sent + 1);
    }
  }
});
