const { google } = require('googleapis');
const fs = require('fs');

async function main() {
  const credentialsStr = fs.readFileSync('api/credentials.json', 'utf8');
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentialsStr),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  
  const spreadsheetId = '10ZTitLYObaWll2p8waWfQ0LJzuPu77Of0IDPL42zzwo';
  
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'RM,FG,SFG 2026'!A1:Z2",
    });
    console.log("Headers:", res.data.values[0]);
    console.log("Row 1:", res.data.values[1]);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
main();
