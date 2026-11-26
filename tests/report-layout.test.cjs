const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const InspectModule = require('docxtemplater/js/inspect-module.js');

const templates = [
  'public/templates/Report_ENVI.docx',
  'public/templates/Report_RawMats.docx',
];

for (const template of templates) {
  const zip = new PizZip(fs.readFileSync(path.resolve(__dirname, '..', template)));
  const parts = Object.keys(zip.files)
    .filter(name => /^word\/(document|header\d+)\.xml$/.test(name))
    .map(name => zip.file(name).asText());

  test(`${template}: report headings center without tabs or space padding`, () => {
    for (const heading of [
      'INTERNATIONAL PHARMACEUTICALS, INC.',
      'QUALITY CONTROL LABORATORY',
      'MICROBIOLOGY ANALYSIS REPORT',
    ]) {
      const paragraphs = parts.flatMap(xml =>
        [...xml.matchAll(/<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?<\/w:p>/g)]
          .map(match => match[0])
      );
      const paragraph = paragraphs.find(xml => xml.includes(heading));
      assert.ok(paragraph, `Missing ${heading}`);
      assert.match(paragraph, /<w:jc w:val="center"\s*\/>/);
      assert.doesNotMatch(paragraph, /<w:tab\s*\/>|<w:ind\b/);
      const text = [...paragraph.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map(match => match[1]).join('');
      assert.equal(text, heading);
    }
  });

  test(`${template}: form textbox leaves the full header width available`, () => {
    for (const xml of parts) {
      for (const [anchor] of xml.matchAll(/<wp:anchor\b[\s\S]*?<\/wp:anchor>/g)) {
        if (!anchor.includes('Form No.')) continue;
        assert.match(anchor, /<wp:wrapNone\s*\/>/);
        assert.doesNotMatch(anchor, /<wp:wrap(?:Square|Tight|Through|TopAndBottom)\b/);
      }
      for (const [shape] of xml.matchAll(/<v:shape\b[\s\S]*?<\/v:shape>/g)) {
        if (!shape.includes('Form No.')) continue;
        assert.match(shape, /<w10:wrap\b[^>]*\btype="none"/);
      }
    }
  });
}

test('updated main report template preserves all generation fields', () => {
  const zip = new PizZip(fs.readFileSync(path.resolve(__dirname, '../public/template.docx')));
  const inspect = InspectModule();
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true, linebreaks: true, modules: [inspect],
  });
  const fields = [
    'Category', 'DateReceived', 'SampleName', 'DateReleased', 'DateMfd',
    'BatchNo', 'FillVol', 'ExpiryDate', 'RequestedBy', 'Purpose', 'MIC', 'PageNumber', 'controlNO.',
    'APC_Spec', 'APC_Result', 'APC_Remarks', 'MY_Spec', 'MY_Result', 'MY_Remarks',
    'GN_Spec', 'GN_Result', 'GN_Remarks', 'OverallRemarks', 'AnalyzedBy', 'DateReleasedOnly',
  ];
  assert.deepEqual(Object.keys(inspect.getAllTags()).sort(), [...fields].sort());
  assert.doesNotThrow(() => doc.render(Object.fromEntries(fields.map(field => [field, `Test ${field}`]))));
});
