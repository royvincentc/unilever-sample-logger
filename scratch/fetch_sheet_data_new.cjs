const { google } = require('googleapis');
const credentials = require('../api/credentials.json');
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function run() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: '1yfoeCEFrL6AYftrmjcuAqsWU6Pu2bZ_mahaUvs9TzbI',
    range: "'SWAB 2026'!A1061:Z1065",
  });
  console.log(JSON.stringify(res.data.values, null, 2));
}

run().catch(console.error);
