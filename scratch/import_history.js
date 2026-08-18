import { initializeApp } from "firebase/app";
import { getFirestore, doc, writeBatch } from "firebase/firestore";
import { google } from 'googleapis';
import fs from 'fs';

const firebaseConfig = {
  apiKey: "AIzaSyCxxViussq2eOVS1NtTrFDnzSsZCttKG0g",
  authDomain: "unilever-qc.firebaseapp.com",
  projectId: "unilever-qc",
  storageBucket: "unilever-qc.firebasestorage.app",
  messagingSenderId: "628633248559",
  appId: "1:628633248559:web:711cdffc89878c2cf0b7da",
  measurementId: "G-WBP9Z6MQ9K"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const spreadsheetId = '10ZTitLYObaWll2p8waWfQ0LJzuPu77Of0IDPL42zzwo';

async function fetchTab(sheets, tabName, sampleType) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tabName}'!A:Z`,
    });
    
    const rows = res.data.values || [];
    if (rows.length === 0) return [];

    let headerRowIndex = rows.findIndex(r => r.some(c => typeof c === 'string' && (c.toUpperCase().includes('CONTROL #') || c.toUpperCase().includes('SAMPLE'))));
    if (headerRowIndex === -1) headerRowIndex = 0;

    const headers = rows[headerRowIndex];
    return rows.slice(headerRowIndex + 1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { 
        if (h) obj[h] = row[i] || ''; 
      });
      return { data: obj, type: sampleType };
    }).filter(r => r.data['CONTROL #'] && r.data['CONTROL #'] !== '-');
  } catch (e) {
    console.error(`Error fetching tab ${tabName}:`, e.message);
    return [];
  }
}

async function main() {
  const credentialsStr = fs.readFileSync('api/credentials.json', 'utf8');
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentialsStr),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log("Fetching sheets data...");
  const [swab, water, raw, air] = await Promise.all([
    fetchTab(sheets, 'SWAB 2026', 'ENVI'),
    fetchTab(sheets, 'WATER 2026', 'WATER'),
    fetchTab(sheets, 'RM,FG,SFG 2026', 'RawMats'),
    fetchTab(sheets, 'AIR 2026', 'AIR')
  ]);

  const allRecords = [...swab, ...water, ...raw, ...air];
  console.log(`Fetched ${allRecords.length} records. Importing to Firestore...`);

  let batch = writeBatch(db);
  let count = 0;

  for (const record of allRecords) {
    const { data, type } = record;
    const controlNum = String(data['CONTROL #']).trim();
    
    // Normalize date string
    const ds = data['DATE SAMPLED'] || data['DATE RECEIVED/SAMPLED'] || new Date().toISOString();
    let dateStr;
    try {
      dateStr = new Date(ds).toISOString();
    } catch {
      dateStr = new Date().toISOString();
    }

    const analyst = String(data['ANALYZED BY'] || data['ANALYST'] || data['ANALYSTS'] || '').trim();
    const statusRaw = String(data['STATUS'] || '').trim().toUpperCase();
    
    let status = 'ONGOING';
    if (statusRaw === 'COMPLETED' || statusRaw === 'RELEASED') status = 'RELEASED';
    else if (statusRaw.includes('PENDING')) status = 'PENDING RELEASE';

    const id = `${type}_${controlNum.replace(/[^A-Z0-9-]/gi, '')}`;
    
    const entry = {
      id,
      sampleType: type,
      controlNumber: controlNum,
      sampleName: data['SAMPLE'] || data['WATER SOURCE'] || data['CUC #'] || 'Unknown Sample',
      submittedAt: dateStr,
      dateSampled: dateStr,
      status: status,
      sheetAnalyst: analyst !== '-' ? analyst : '',
      results: data
    };

    const docRef = doc(db, 'history', id);
    batch.set(docRef, entry);
    count++;

    if (count % 400 === 0) {
      await batch.commit();
      console.log(`Committed ${count} records`);
      batch = writeBatch(db);
    }
  }

  if (count % 400 !== 0) {
    await batch.commit();
    console.log(`Committed ${count} records`);
  }

  console.log("Import complete!");
  process.exit(0);
}

main();
