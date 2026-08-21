const { google } = require('googleapis');
const credentials = require('../api/credentials.json');
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function run() {
  const spreadsheetId = '1yfoeCEFrL6AYftrmjcuAqsWU6Pu2bZ_mahaUvs9TzbI';
  const sheetTab = 'SWAB 2026';
  
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTab}'!1:5`, // fetch first 5 rows to ensure we find the header
  });

  const rows = headerResponse.data.values || [];
  let headerRowIndex = rows.findIndex((r) => r.some(c => typeof c === 'string' && (c.toUpperCase().includes('CONTROL #') || c.toUpperCase().includes('SAMPLE'))));
  if (headerRowIndex === -1) headerRowIndex = 0;

  const headers = rows[headerRowIndex];
  const colIndexControl = headers.findIndex(h => h.toUpperCase().includes('CONTROL') || h.toUpperCase().includes('SAMPLE'));
  const idColumnRange = colIndexControl < 26 
        ? String.fromCharCode(65 + colIndexControl)
        : 'A';
  
  const idResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTab}'!${idColumnRange}:${idColumnRange}`,
  });
  
  const ids = idResponse.data.values?.map(r => r[0]) || [];
  console.log("Found ids length: ", ids.length);
  
  let emptyRowIndex = -1;
  for (let i = headerRowIndex + 1; i < 5000; i++) {
    if (!ids[i] || String(ids[i]).trim() === '') {
      emptyRowIndex = i;
      break;
    }
  }

  console.log("Empty row index: ", emptyRowIndex);
  
  // Try to update the row
  if (emptyRowIndex !== -1) {
    const sheetRowNumber = emptyRowIndex + 1;
    console.log("Will update row: ", sheetRowNumber);
    // Let's not actually write yet to be safe
  }
}

run().catch(console.error);
