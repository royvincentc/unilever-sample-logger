const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

function load(file, dependencies, globals = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console, Date,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    ...globals,
  }, { filename: file });
  return exports;
}

function resultCells(buffer, parameter) {
  const xml = new PizZip(buffer).file('word/document.xml').asText();
  const row = [...xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)]
    .map(match => match[0]).find(text => text.includes(parameter));
  assert.ok(row, `Missing parameter: ${parameter}`);
  return [...row.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map(cell =>
    [...cell[0].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map(match => match[1].replace(/&lt;/g, '<').replace(/&amp;/g, '&')).join('')
  );
}

const loadReport = (globals) => load('src/utils/report.ts', {
  pizzip: PizZip, docxtemplater: Docxtemplater, 'file-saver': { saveAs() {} },
}, globals);

test('MIC lookup handles headed and plain MIC sheets, dual analysts and accents', () => {
  const { findMicNumbers } = loadReport();
  const headed = [['MIC LIST'], ['NAME', 'SURNAME', 'MIC NO.'], ['Karen M. Juen', 'JUEN', 'MIC-001'], ['Roy Vincent Codiñera', 'CODIÑERA', 'MIC-002']];
  assert.equal(findMicNumbers(headed, 'JUEN'), 'MIC-001');
  assert.equal(findMicNumbers(headed, 'JUEN / CODINERA'), 'MIC-001 / MIC-002');
  assert.equal(findMicNumbers([['Karen M. Juen', 'MIC-001']], 'juen'), 'MIC-001');
  assert.equal(findMicNumbers(headed, 'UNKNOWN'), '');
  assert.equal(findMicNumbers([], 'JUEN'), '');
});

test('Results download fills control number, MIC, page number, requester and both analysts', async () => {
  let output;
  const { generateDocxReport } = load('src/utils/report.ts', {
    pizzip: PizZip, docxtemplater: Docxtemplater, 'file-saver': { saveAs: blob => { output = blob; } },
  }, {
    fetch: async () => ({
      blob: async () => ({ arrayBuffer: async () => fs.readFileSync(path.join(__dirname, '../public/template.docx')) }),
    }),
  });
  await generateDocxReport({ TYPE: 'ROH', SAMPLE: 'Glycerin', 'CONTROL #': '26-1358', 'PERFORMED BY': 'JUEN/CODINERA', RFAF: 'Sheet Name' }, '', 'RawMats', {
    pageNumber: '42', requestedBy: 'Juan Dela Cruz', micRows: [['NAME', 'MIC'], ['JUEN', 'MIC-001'], ['CODINERA', 'MIC-002']],
  });
  const zip = new PizZip(await output.arrayBuffer());
  const text = ['word/header1.xml', 'word/footer1.xml'].map(file => zip.file(file).asText().replace(/<[^>]+>/g, '')).join(' ');
  for (const expected of ['26-1358', 'MIC-001 / MIC-002', '42', 'Juan Dela Cruz', 'Karen M. Juen / Roy Vincent Codiñera']) {
    assert.ok(text.includes(expected), `Missing ${expected}`);
  }
  assert.ok(!text.includes('Sheet Name'), 'Typed requester should replace the RFAF column value');
});

async function browserReport(data) {
  let output;
  const { generateDocxReport } = load('src/utils/report.ts', {
    pizzip: PizZip,
    docxtemplater: Docxtemplater,
    'file-saver': { saveAs: blob => { output = blob; } },
  }, {
    fetch: async () => ({
      blob: async () => ({ arrayBuffer: async () => fs.readFileSync(path.join(__dirname, '../public/template.docx')) }),
    }),
  });
  assert.equal(await generateDocxReport({
    TYPE: 'FG', SAMPLE: 'Surf Liquid Detergent', 'CONTROL #': '26-1358',
    '(S) Aerobic Plate Count': '<300 cfu/g',
    '(S) Yeast and Molds': '<100 cfu/g',
    '(A) Aerobic Plate Count': '999', '(A) Yeast and Molds': '888',
    ...data,
  }, '', 'RawMats'), true);
  return output.arrayBuffer();
}

for (const [apc, my, remarks] of [
  ['<10 cfu/g', '<10 cfu/g', 'Passed'],
  ['45 cfu/g', '20 cfu/g', 'Passed'],
  ['450 cfu/g', '200 cfu/g', 'Failed'],
  [0, 0, 'Passed'],
  ['', '', ''],
]) {
  test(`Results download preserves calculated values ${JSON.stringify([apc, my])}`, async () => {
    const buffer = await browserReport({
      '(C) Aerobic Plate Count': apc, '(C) Yeast and Molds': my,
    });
    assert.deepEqual(resultCells(buffer, 'Aerobic Plate Count').slice(1), ['<300 cfu/g', String(apc), remarks]);
    assert.deepEqual(resultCells(buffer, 'Molds &amp; Yeast').slice(1), ['<100 cfu/g', String(my), remarks]);
  });
}

test('Results download falls back only to AB and AD when calculated headers are unavailable', async () => {
  const raw = Array(31).fill('');
  raw[25] = '888';
  raw[27] = '<10 cfu/g';
  raw[28] = 'No Growth';
  raw[29] = '<20 cfu/g';
  raw[30] = '999';
  const buffer = await browserReport({ __rawRow: raw });
  assert.equal(resultCells(buffer, 'Aerobic Plate Count')[2], '<10 cfu/g');
  assert.equal(resultCells(buffer, 'Molds &amp; Yeast')[2], '<20 cfu/g');
});

for (const calculated of ['<10 cfu/g', '450 cfu/g', '']) {
  test(`History download uses calculated columns even when they contain ${JSON.stringify(calculated)}`, async () => {
    const handler = load('api/generate-report.ts', {
      fs, path, pizzip: PizZip,
      './_sheets.js': { getSheetsClient: async () => ({ spreadsheets: { values: {
        get: async () => ({ data: { values: [
          ['CONTROL #', 'SAMPLE', '(S) Aerobic Plate Count', '(S) Yeast and Molds',
            '(A) Aerobic Plate Count', '(A) Yeast and Molds',
            '(C) Aerobic Plate Count', '(C) Yeast and Molds'],
          ['26-1358', 'Surf Liquid Detergent', '<300 cfu/g', '<100 cfu/g',
            '999', '888', calculated, calculated],
        ] } }),
      } } }) },
    }).default;
    let buffer;
    await handler({
      method: 'POST',
      body: { sampleType: 'RawMats', controlNumber: '26-1358', spreadsheetId: 'test-sheet', dateSampled: '2026-11-20' },
    }, {
      setHeader() {},
      status(code) { assert.fail(`Unexpected HTTP status ${code}`); },
      send(value) { buffer = value; },
    });
    assert.equal(resultCells(buffer, 'Aerobic Plate Count')[2], calculated);
    assert.equal(resultCells(buffer, 'Molds &amp; Yeast Count')[2], calculated);
  });
}
