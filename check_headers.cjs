const { google } = require('googleapis');
const fs = require('fs');

async function main() {
  const credentialsStr = fs.readFileSync('api/credentials.json', 'utf8');
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentialsStr),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  
  const spreadsheetId = '1yfoeCEFrL6AYftrmjcuAqsWU6Pu2bZ_mahaUvs9TzbI';
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "'RM,FG,SFG 2026'!A1:AJ10",
  });
  const rows = res.data.values || [];
  rows.forEach((r, i) => {
    console.log(`Row ${i+1}:`, JSON.stringify(r));
  });
}
main();
