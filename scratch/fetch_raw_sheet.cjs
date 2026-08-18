import { google } from 'googleapis';

const credentials = require('./credentials.json');
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function run() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: '10ZTitLYObaWll2p8waWfQ0LJzuPu77Of0IDPL42zzwo',
    range: "'RM,FG,SFG 2026'!A1:Z50",
  });
  console.log(JSON.stringify(res.data.values, null, 2));
}

run().catch(console.error);
