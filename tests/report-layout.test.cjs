const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PizZip = require('pizzip');

const templates = [
  'public/template.docx',
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

test('main report header table fits within the page margins', () => {
  const zip = new PizZip(fs.readFileSync(path.resolve(__dirname, '../public/template.docx')));
  const document = zip.file('word/document.xml').asText();
  const pageWidth = Number(document.match(/<w:pgSz\b[^>]*w:w="(\d+)"/)[1]);
  const margins = document.match(/<w:pgMar\b[^>]*>/)[0];
  const left = Number(margins.match(/w:left="(\d+)"/)[1]);
  const right = Number(margins.match(/w:right="(\d+)"/)[1]);
  const header = zip.file('word/header2.xml').asText();
  const tableWidth = Number(header.match(/<w:tblW\b[^>]*w:w="(\d+)"/)[1]);
  const position = Number(header.match(/<w:tblpPr\b[^>]*w:tblpX="(\d+)"/)[1]);
  assert.ok(position >= left);
  assert.ok(position + tableWidth <= pageWidth - right);
  const grid = [...header.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)]
    .map(match => Number(match[1]));
  assert.equal(grid.reduce((sum, width) => sum + width, 0), tableWidth);
  for (const [row] of header.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)) {
    const widths = [...row.matchAll(/<w:tcW w:w="(\d+)" w:type="dxa"\/>/g)]
      .map(match => Number(match[1]));
    assert.equal(widths.reduce((sum, width) => sum + width, 0), tableWidth);
  }
});
