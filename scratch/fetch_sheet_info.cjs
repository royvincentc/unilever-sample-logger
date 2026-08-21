const { google } = require('googleapis');
const credentials = require('../api/credentials.json');
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function run() {
  const res = await sheets.spreadsheets.get({
    spreadsheetId: '1-pGOoxmZw4qCfK3KnjeRvbK_VbfEAZJUn7GjI01hkXc',
  });
  console.log(res.data.sheets.map(s => s.properties.title));
}

run().catch(console.error);
