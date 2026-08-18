import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { getSheetsClient } from './_sheets';

/**
 * Replaces the header table values in header1.xml
 */
function patchHeader(xml: string, fieldMap: Record<string, string>): string {
  let modifiedXml = xml;
  // This is a naive but effective regex approach for the exact IPI template format.
  // We look for a table cell containing the label, followed by a cell containing ':', 
  // followed by the value cell. 
  
  for (const [label, newValue] of Object.entries(fieldMap)) {
    // Escape label for regex
    const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Complex regex to find the row containing:
    // <w:tc>...label...</w:tc> <w:tc>...:...</w:tc> <w:tc>...VALUE...</w:tc>
    // Since XML can be messy, we'll do a simpler approach:
    // Find the label text, then find the next `<w:t>` after the `:`
    
    const labelIdx = modifiedXml.indexOf(`>${label}<`);
    if (labelIdx === -1) continue;
    
    const colonIdx = modifiedXml.indexOf(`>:</w:t>`, labelIdx);
    if (colonIdx === -1) continue;
    
    // The next <w:tc> block after the colon contains the value to replace.
    // We'll find the next <w:t> or <w:t xml:space="preserve">
    const nextTcStart = modifiedXml.indexOf('<w:tc>', colonIdx);
    if (nextTcStart === -1) continue;
    
    const nextTcEnd = modifiedXml.indexOf('</w:tc>', nextTcStart);
    if (nextTcEnd === -1) continue;
    
    // Extract the target cell XML
    let tcXml = modifiedXml.substring(nextTcStart, nextTcEnd + 7);
    
    // We want to replace all text inside this cell with the new value, keeping formatting.
    // The safest way without a full XML parser is to find the first <w:r> block, put our text there,
    // and remove other <w:r> blocks.
    
    const firstRStart = tcXml.indexOf('<w:r>');
    const firstREnd = tcXml.indexOf('</w:r>', firstRStart) + 6;
    
    if (firstRStart !== -1) {
      // Just brutally replace the cell contents with a single run
      const safeVal = newValue.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const spaceAttr = (safeVal.startsWith(' ') || safeVal.endsWith(' ')) ? ' xml:space="preserve"' : '';
      
      const newTcXml = tcXml.substring(0, tcXml.indexOf('<w:p>') + 5) +
        `<w:pPr><w:jc w:val="left"/></w:pPr>` + 
        `<w:r><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>` +
        `<w:t${spaceAttr}>${safeVal}</w:t></w:r></w:p></w:tc>`;
        
      modifiedXml = modifiedXml.substring(0, nextTcStart) + newTcXml + modifiedXml.substring(nextTcEnd + 7);
    }
  }
  
  return modifiedXml;
}

/**
 * Escapes XML strings
 */
function esc(str: string) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Helper to build a table cell
 */
function cellXml(text: string, opts: { bold?: boolean, center?: boolean, color?: string, sz?: string, colspan?: number, bt?: boolean, bb?: boolean, nil_top?: boolean, nil_bot?: boolean } = {}) {
  const span = opts.colspan ? `<w:gridSpan w:val="${opts.colspan}"/>` : '';
  let b_parts = '';
  if (opts.nil_top) b_parts += '<w:top w:val="nil"/>';
  else if (opts.bt) b_parts += '<w:top w:val="single" w:color="auto" w:sz="4" w:space="0"/>';
  
  if (opts.nil_bot) b_parts += '<w:bottom w:val="nil"/>';
  else if (opts.bb) b_parts += '<w:bottom w:val="single" w:color="auto" w:sz="4" w:space="0"/>';
  
  const borders = b_parts ? `<w:tcBorders>${b_parts}</w:tcBorders>` : '';
  const jc = opts.center ? 'center' : 'left';
  const b_xml = opts.bold ? '<w:b/>' : '';
  const c_xml = opts.color ? `<w:color w:val="${opts.color}"/>` : '';
  const sz = opts.sz || '18';
  
  return `<w:tc>` +
    `<w:tcPr>${span}${borders}<w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="${jc}"/></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"/>${b_xml}${c_xml}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>` +
    `<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p></w:tc>`;
}

function rowXml(cells: string, height = '567') {
  return `<w:tr><w:trPr><w:trHeight w:val="${height}" w:hRule="atLeast"/><w:jc w:val="center"/></w:trPr>${cells}</w:tr>`;
}

function tblXml(gridCols: number[], rows: string) {
  const grid = gridCols.map(w => `<w:gridCol w:w="${w}"/>`).join('');
  return `<w:tbl xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:tblPr><w:tblStyle w:val="14"/><w:tblW w:w="0" w:type="auto"/><w:jc w:val="center"/>` +
    `<w:tblBorders>` +
    `<w:top w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
    `<w:left w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
    `<w:bottom w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
    `<w:right w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
    `<w:insideH w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
    `<w:insideV w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
    `</w:tblBorders><w:tblLayout w:type="autofit"/><w:tblCellMar>` +
    `<w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>` +
    `<w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/>` +
    `</w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows}</w:tbl>`;
}

function buildEnviTable(swabs: any[]) {
  const r1 = rowXml(
    cellXml('PARAMETERS', { center: true, nil_top: true, bb: true }) +
    cellXml('ACTUAL RESULTS', { center: true, nil_top: true, bb: true, colspan: 4 }),
    '472'
  );
  const r2 = rowXml(
    cellXml('SAMPLE LOCATION', { bold: true, center: true, bt: true }) +
    cellXml('TVC (COUNT)', { bold: true, center: true, bt: true }) +
    cellXml('TVC (cfu/100cm²)', { bold: true, center: true, bt: true }) +
    cellXml('GRAM STAINING', { bold: true, center: true, bt: true }) +
    cellXml('REMARKS', { bold: true, center: true, bt: true }),
    '472'
  );
  
  let data = '';
  for (const s of swabs) {
    const rmk = s.remarks || '';
    const rCol = rmk.toLowerCase() === 'passed' ? '008000' : 'C00000';
    const boldR = rmk.toUpperCase() === 'PASSED' || rmk.toUpperCase() === 'FAILED';
    const cnt = String(s.tvc_count || '0');
    const cfu = String(s.tvc_cfu || '0');
    const cCnt = cnt.toUpperCase() === 'TNTC' ? 'C00000' : undefined;
    const cCfu = cfu.toUpperCase() === 'TNTC' ? 'C00000' : undefined;
    
    data += rowXml(
      cellXml(s.location) +
      cellXml(cnt, { center: true, bold: cnt.toUpperCase() === 'TNTC', color: cCnt }) +
      cellXml(cfu, { center: true, bold: cfu.toUpperCase() === 'TNTC', color: cCfu }) +
      cellXml(s.gram_staining || 'N/A', { center: true }) +
      cellXml(rmk, { center: true, bold: boldR, color: rCol }),
      '420'
    );
  }
  return tblXml([2500, 1200, 1900, 2400, 1116], r1 + r2 + data);
}

function buildRmTable(tests: any[]) {
  const r1 = rowXml(
    cellXml('PARAMETERS', { center: true, nil_top: true, bb: true }) +
    cellXml('SPECIFICATIONS', { center: true, nil_top: true, bb: true }) +
    cellXml('ACTUAL RESULTS', { center: true, nil_top: true, bb: true, colspan: 2 })
  );
  const r2 = rowXml(
    cellXml('ANALYSIS DESIRED:', { bold: true, center: true, bt: true }) +
    cellXml('Standard Specifications', { center: true, bt: true }) +
    cellXml('Results', { center: true, bt: true }) +
    cellXml('Remarks', { center: true, bt: true })
  );
  
  let data = '';
  for (const t of tests) {
    const rmk = t.remarks || '';
    const color = rmk.toLowerCase() === 'passed' ? '008000' : 'C00000';
    const boldR = rmk.toUpperCase() === 'PASSED' || rmk.toUpperCase() === 'FAILED';
    data += rowXml(
      cellXml(t.parameter) +
      cellXml(t.specifications, { center: true }) +
      cellXml(t.results, { center: true }) +
      cellXml(rmk, { center: true, bold: boldR, color: color })
    );
  }
  return tblXml([3061, 2672, 2245, 1438], r1 + r2 + data);
}

function replaceBodyTable(docXml: string, newTableXml: string) {
  const tblStart = docXml.indexOf('<w:tbl>');
  const tblEnd = docXml.indexOf('</w:tbl>', tblStart);
  if (tblStart !== -1 && tblEnd !== -1) {
    return docXml.substring(0, tblStart) + newTableXml + docXml.substring(tblEnd + 8);
  }
  return docXml;
}

// Helper to safely get values from case-insensitive or slight header variations
const getVal = (row: Record<string, string>, keys: string[]) => {
  for (const k of keys) {
    const found = Object.keys(row).find(x => x.toUpperCase().trim() === k.toUpperCase());
    if (found && row[found]) return row[found];
  }
  return '';
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { sampleType, controlNumber, spreadsheetId, dateSampled } = req.body;
    
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Missing spreadsheetId. Ensure Vercel environment has GOOGLE_CREDENTIALS.' });
    }

    const type = sampleType;
    let templatePath = '';
    
    const date = dateSampled ? new Date(dateSampled) : new Date();
    const yearStr = date.getFullYear().toString();
    let sheetTab = '';
    
    if (type === 'ENVI') {
      templatePath = 'public/templates/Report_ENVI.docx';
      sheetTab = `SWAB ${yearStr}`;
    } else if (type === 'RawMats') {
      templatePath = 'public/templates/Report_RawMats.docx';
      sheetTab = `RM,FG,SFG ${yearStr}`;
    } else {
      return res.status(400).json({ error: 'Unsupported sample type for report generation' });
    }
    
    const absolutePath = path.resolve(templatePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: `Template not found at ${absolutePath}` });
    }
    
    // Fetch data from Google Sheets
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTab}'!A:Z`,
    });
    
    const rows = response.data.values || [];
    if (rows.length < 2) return res.status(404).json({ error: 'Sheet is empty' });
    
    // Find the header row dynamically
    let headerRowIndex = rows.findIndex((r: any[]) => r.some(c => typeof c === 'string' && (c.toUpperCase().includes('CONTROL #') || c.toUpperCase().includes('SAMPLE'))));
    if (headerRowIndex === -1) headerRowIndex = 0;

    const headers = rows[headerRowIndex];
    const dataRows = rows.slice(headerRowIndex + 1).map(row => {
      const rowObject: Record<string, string> = {};
      headers.forEach((header, index) => {
        rowObject[header as string] = row[index] || '';
      });
      return rowObject;
    });
    
    // Find matching rows by control number
    const target = controlNumber.replace(/^[A-Z-]+/i, '');
    const matchedRows = dataRows.filter(r => {
      const c = (r['CONTROL #'] || '').trim().replace(/^[A-Z-]+/i, '');
      return c === target;
    });
    
    if (matchedRows.length === 0) {
      return res.status(404).json({ error: 'Control number not found in sheet' });
    }
    
    // Construct headerData
    let headerData: Record<string, string> = {};
    if (type === 'ENVI') {
      headerData = {
        'Category':            'Environmental Monitoring',
        'Date&Time Received':  getVal(matchedRows[0], ['DATE RECEIVED', 'DATE & TIME RECEIVED']) + '; ' + getVal(matchedRows[0], ['TIME RECEIVED']),
        'Name of Sample':      getVal(matchedRows[0], ['SAMPLE', 'NAME OF SAMPLE', 'SAMPLE NAME']),
        'Date&Time Released':  getVal(matchedRows[0], ['DATE RELEASED', 'DATE & TIME RELEASED']) + '; ' + getVal(matchedRows[0], ['TIME RELEASED']),
        'Date Mfd.':           getVal(matchedRows[0], ['MFG DATE']) || 'N/A',
        'Batch/Lot No.':       getVal(matchedRows[0], ['BATCH / LOT NO.', 'CONTROL #']),
        'Fill Vol./Wt.':       'N/A',
        'Expiry Date':         getVal(matchedRows[0], ['EXPIRY DATE']) || 'N/A',
        'Batch/Lot Size':      getVal(matchedRows[0], ['BATCH/LOT SIZE']) || 'N/A',
        'Requested by':        getVal(matchedRows[0], ['SUBMITTED BY', 'ENDORSED TO', 'REQUESTED BY']),
        'Purpose':             'Microbial Analysis - Environmental Monitoring',
        'Logbook':             getVal(matchedRows[0], ['LOGBOOK NO.']),
      };
    } else if (type === 'RawMats') {
      headerData = {
        'Category':            'Raw Material',
        'Date&Time Received':  getVal(matchedRows[0], ['DATE RECEIVED', 'DATE & TIME RECEIVED']) + '; ' + getVal(matchedRows[0], ['TIME RECEIVED']),
        'Name of Sample':      getVal(matchedRows[0], ['SAMPLE', 'NAME OF SAMPLE', 'SAMPLE NAME']),
        'Date&Time Released':  getVal(matchedRows[0], ['DATE RELEASED', 'DATE & TIME RELEASED']) + '; ' + getVal(matchedRows[0], ['TIME RELEASED']),
        'Date Mfd.':           getVal(matchedRows[0], ['MFG DATE']) || 'N/A',
        'Batch/Lot No.':       getVal(matchedRows[0], ['BATCH / LOT NO.', 'CONTROL #']),
        'Fill Vol./Wt.':       'N/A',
        'Expiry Date':         getVal(matchedRows[0], ['EXPIRY DATE']) || 'N/A',
        'Batch/Lot Size':      getVal(matchedRows[0], ['BATCH/LOT SIZE']) || 'N/A',
        'Requested by':        getVal(matchedRows[0], ['SUBMITTED BY', 'ENDORSED TO', 'REQUESTED BY']),
        'Purpose':             'Microbial Analysis',
        'Logbook':             getVal(matchedRows[0], ['LOGBOOK NO.']),
      };
    }
    
    // Construct tableData
    let tableData: any[] = [];
    if (type === 'ENVI') {
      tableData = matchedRows.map(r => ({
        location: getVal(r, ['LOCATION', 'SAMPLE LOCATION']),
        tvc_count: getVal(r, ['TVC COUNT', 'TVC (COUNT)']),
        tvc_cfu: getVal(r, ['TVC CFU', 'TVC (cfu/100cm2)', 'TVC (cfu/100cmA)']),
        gram_staining: getVal(r, ['GRAM STAINING', 'GRAM STAIN']),
        remarks: getVal(r, ['REMARKS', 'STATUS'])
      }));
    } else if (type === 'RawMats') {
      tableData = matchedRows.map(r => ({
        parameter: getVal(r, ['PARAMETERS', 'PARAMETER']),
        specifications: getVal(r, ['SPECIFICATION', 'SPECIFICATIONS']),
        results: getVal(r, ['RESULT', 'RESULTS']),
        remarks: getVal(r, ['REMARKS', 'STATUS'])
      }));
    }
    
    const content = fs.readFileSync(absolutePath, 'binary');
    const zip = new PizZip(content);
    
    let headerXml = zip.file('word/header1.xml')?.asText();
    if (headerXml && headerData) {
      headerXml = patchHeader(headerXml, headerData);
      zip.file('word/header1.xml', headerXml);
    }
    
    let docXml = zip.file('word/document.xml')?.asText();
    if (docXml && tableData) {
      let newTableXml = '';
      if (type === 'ENVI') {
        newTableXml = buildEnviTable(tableData);
      } else if (type === 'RawMats') {
        newTableXml = buildRmTable(tableData);
      }
      if (newTableXml) {
        docXml = replaceBodyTable(docXml, newTableXml);
        zip.file('word/document.xml', docXml);
      }
    }
    
    const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=Report_${type}_${headerData['Batch/Lot No.'] || 'Generated'}.docx`);
    return res.send(buf);
    
  } catch (error: any) {
    console.error('Report generation failed:', error);
    return res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
}
