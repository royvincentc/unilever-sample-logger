# n8n Workflow Setup Guide — SampleLog App

This guide walks you through setting up the n8n workflows that connect the SampleLog web app to your Google Sheets.

---

## Prerequisites

1. **Self-hosted n8n** — Already running ✅
2. **Google Cloud Project** with Google Sheets API enabled
3. **Google Sheets** — Practice Sheet ID: `12GkLM06FaO9Qn_E4TDQp852nUvf53mxl6nUI9C9GEdc`

---

## Step 1: Set Up Google Sheets Credentials in n8n

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable **Google Sheets API**:
   - Go to **APIs & Services → Library**
   - Search "Google Sheets API" → Click **Enable**
4. Create **OAuth2 Credentials**:
   - Go to **APIs & Services → Credentials**
   - Click **Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Add redirect URI: `https://YOUR-N8N-URL/rest/oauth2-credential/callback`
   - Copy the **Client ID** and **Client Secret**
5. In n8n:
   - Go to **Credentials → Add Credential → Google Sheets OAuth2 API**
   - Paste Client ID and Client Secret
   - Click **Connect** and authorize with your Google account
   - Make sure the account has access to the practice spreadsheet

---

## Step 2: Create ENVI Workflow

### Overview
```
Webhook (POST) → Code (Parse Data) → Google Sheets (Get Rows) → Code (Generate Control #) → Google Sheets (Append Row) → Respond to Webhook
```

### Step-by-step:

#### Node 1: Webhook Trigger
- **HTTP Method**: POST
- **Path**: `envi-submit`
- **Response Mode**: Using 'Respond to Webhook' node
- Copy the **Production URL** — you'll paste this into the SampleLog Settings page
- **Authentication**: Set up Header Auth!
  - Under Webhook settings, look for Authentication.
  - Set it to **Header Auth**.
  - Create a new credential with the Name `x-api-key` and the Value matching the `VITE_N8N_API_KEY` defined in your application's `.env` file.

#### Node 2: Code — Parse Data
```javascript
const data = $input.first().json.body || $input.first().json;

// Determine sheet tab name from date
const date = new Date(data.dateSampled);
const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const sheetTab = `${months[date.getMonth()]} ENVI`;
const year = String(date.getFullYear()).slice(-2);

return [{
  json: {
    ...data,
    sheetTab,
    year,
    spreadsheetId: data.spreadsheetId || '12GkLM06FaO9Qn_E4TDQp852nUvf53mxl6nUI9C9GEdc'
  }
}];
```

#### Node 3: Google Sheets — Get Existing Rows
- Add a **Google Sheets** node
- **Operation**: Select **"Get row(s) in sheet"**
- **Document**: Click the field, switch to **Expression** mode (click the `=` icon), enter: `{{ $json.spreadsheetId }}`
- **Sheet**: Switch to **Expression** mode, enter: `{{ $json.sheetTab }}`
- **Options**: Leave default (no extra options needed — the node returns all rows by default)
- This fetches all existing data so the Code node can find the last control number in column A

#### Node 4: Code — Generate Control Number
```javascript
const inputData = $('Code — Parse Data').first().json;
const existingRows = $input.all();
const samples = inputData.selectedSamples || [];

// Find rows where SAMPLE column is empty (these are override targets)
const emptyRows = [];
let lastNum = 0;

for (const item of existingRows) {
  const rowData = item.json;
  const controlCol = rowData['CONTROL #'] || '';
  
  // Track highest control number
  const match = controlCol.match(/E(\d+)-(\d+)/);
  if (match) {
    const num = parseInt(match[2], 10);
    if (num > lastNum) lastNum = num;
  }

  // Target row if SAMPLE is empty (regardless of whether CONTROL # exists)
  const sampleVal = rowData['SAMPLE'] || '';
  if (sampleVal.toString().trim() === '') {
    emptyRows.push(item);
  }
}

// Bulk samples share ONE control number (per P0001 guidelines)
const nextNum = lastNum + 1;
const sharedControlNumber = `E${inputData.year}-${String(nextNum).padStart(3, '0')}`;

const results = [];

for (let i = 0; i < samples.length; i++) {
  const row = {
    'CONTROL #': sharedControlNumber, // Keep control number on ALL rows for data integrity
    'SAMPLE': samples[i],
    'QTY': '1',
    'UNIT': '1 swab',
    'DATE SWABBED': inputData.dateSampled,
    'TIME SWABBED': inputData.timeSampled,
    'SWABBED BY': inputData.swabbedBy,
    'DATE ANALYZED': inputData.dateAnalyzed || '',
    'ANALYZED BY': inputData.analyzedBy || '',
    'STATUS': 'ON GOING',
  };

  results.push({ json: row });
}

return results;
```

#### Node 5: Google Sheets — Append Rows
- Add a **Google Sheets** node
- **Operation**: Select **"Append Row"**
- **Document**: Switch to **Expression** mode, enter: `{{ $('Code — Parse Data').first().json.spreadsheetId }}`
- **Sheet**: Switch to **Expression** mode, enter: `{{ $('Code — Parse Data').first().json.sheetTab }}`
- **Mapping Mode**: **Map Automatically**
- **Options** → **Handling extra fields in input** → **"Ignore"**
- ⚠️ **Data Location on Sheet**: Header Row = `2`, First Data Row = `3`

#### Node 6: Respond to Webhook
- **Response Body**: 
```json
{
  "success": true,
  "controlNumber": "{{ $('Code — Generate Control Number').first().json['CONTROL #'] }}"
}
```

---

## Step 3: Create WATER Workflow

Create a **new workflow** in n8n. Add these 6 nodes and connect them in order:

### Overview
```
Webhook (POST) → Code (Parse Data) → Google Sheets (Get Rows) → Code (Generate Control #) → Google Sheets (Append Row) → Respond to Webhook
```

### Step-by-step:

#### Node 1: Webhook Trigger
- **HTTP Method**: POST
- **Path**: `water-submit`
- **Response Mode**: Using 'Respond to Webhook' node
- Copy the **Production URL** — you'll paste this into the SampleLog Settings page
- **Authentication**: Set up Header Auth!
  - Under Webhook settings, look for Authentication.
  - Set it to **Header Auth**.
  - Create a new credential with the Name `x-api-key` and the Value matching the `VITE_N8N_API_KEY` defined in your application's `.env` file.

#### Node 2: Code — Parse Data
- Add a **Code** node, paste this:
```javascript
const data = $input.first().json.body || $input.first().json;

const date = new Date(data.dateSampled);
const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const sheetTab = `${months[date.getMonth()]} WATER`;
const year = String(date.getFullYear()).slice(-2);

return [{
  json: {
    ...data,
    sheetTab,
    year,
    spreadsheetId: data.spreadsheetId || '12GkLM06FaO9Qn_E4TDQp852nUvf53mxl6nUI9C9GEdc'
  }
}];
```

#### Node 3: Google Sheets — Get Existing Rows
- Add a **Google Sheets** node
- **Operation**: Select **"Get row(s) in sheet"**
- **Document**: Switch to **Expression** mode, enter: `{{ $json.spreadsheetId }}`
- **Sheet**: Switch to **Expression** mode, enter: `{{ $json.sheetTab }}`
- **Options**: Leave default

#### Node 4: Code — Generate Control Number
- Add a **Code** node, paste this:
```javascript
const inputData = $('Code — Parse Data').first().json;
const existingRows = $input.all();

let targetRow = null;
let lastNum = 0;

for (const item of existingRows) {
  const rowData = item.json;
  const controlCol = rowData['CONTROL #'] || '';
  
  // Track highest control number
  const match = controlCol.match(/W(\d+)-(\d+)/);
  if (match) {
    const num = parseInt(match[2], 10);
    if (num > lastNum) lastNum = num;
  }

  // Find first row where WATER SOURCE is empty (override target)
  const waterVal = rowData['WATER SOURCE'] || '';
  if (!targetRow && waterVal.toString().trim() === '') {
    targetRow = item;
  }
}

// Use existing empty row's control number if available, otherwise generate new
let controlNumber;
if (targetRow) {
  controlNumber = targetRow.json['CONTROL #'] || '';
}
if (!controlNumber) {
  const nextNum = lastNum + 1;
  controlNumber = `W${inputData.year}-${String(nextNum).padStart(3, '0')}`;
}

return [{
  json: {
    'CONTROL #': controlNumber,
    'WATER SOURCE': inputData.waterSource,
    'QTY': '1',
    'UNIT': '120 mL',
    'DATE SAMPLED': inputData.dateSampled,
    'TIME': inputData.timeSampled,
    'SAMPLED BY': inputData.sampledBy,
    'DATE ANALYZED': inputData.dateAnalyzed || '',
    'ANALYZED BY': inputData.analyzedBy || '',
    'STATUS': 'ON GOING',
  }
}];
```

#### Node 5: Google Sheets — Append or Update Row
- Add a **Google Sheets** node
- **Operation**: Select **"Append or Update"**
- **Document**: Switch to **Expression** mode, enter: `{{ $('Code — Parse Data').first().json.spreadsheetId }}`
- **Sheet**: Switch to **Expression** mode, enter: `{{ $('Code — Parse Data').first().json.sheetTab }}`
- **Column to Match On**: `CONTROL #`
- **Mapping Mode**: **Map Automatically**
- **Options** → **Handling extra fields in input** → **"Ignore"**
- ⚠️ **Data Location on Sheet**: Header Row = `2`, First Data Row = `3`

#### Node 6: Respond to Webhook
- **Response Body** (set as Expression):
```json
{
  "success": true,
  "controlNumber": "{{ $('Code — Generate Control Number').first().json['CONTROL #'] }}"
}
```

---

## Step 4: Create RawMats Workflow

Create a **new workflow** in n8n. Add these 6 nodes and connect them in order:

### Overview
```
Webhook (POST) → Code (Parse Data) → Google Sheets (Get Rows) → Code (Generate Control #) → Google Sheets (Append Row) → Respond to Webhook
```

### Step-by-step:

#### Node 1: Webhook Trigger
- **HTTP Method**: POST
- **Path**: `rawmats-submit`
- **Response Mode**: Using 'Respond to Webhook' node
- Copy the **Production URL**
- **Authentication**: Set up Header Auth!
  - Under Webhook settings, look for Authentication.
  - Set it to **Header Auth**.
  - Create a new credential with the Name `x-api-key` and the Value matching the `VITE_N8N_API_KEY` defined in your application's `.env` file.

#### Node 2: Code — Parse Data
- Add a **Code** node, paste this:
```javascript
const data = $input.first().json.body || $input.first().json;

const date = new Date(data.dateSampled);
const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const sheetTab = `${months[date.getMonth()]} RawMats,FG&SFG`;
const year = String(date.getFullYear()).slice(-2);

return [{
  json: {
    ...data,
    sheetTab,
    year,
    spreadsheetId: data.spreadsheetId || '12GkLM06FaO9Qn_E4TDQp852nUvf53mxl6nUI9C9GEdc'
  }
}];
```

#### Node 3: Google Sheets — Get Existing Rows
- Add a **Google Sheets** node
- **Operation**: Select **"Get row(s) in sheet"**
- **Document**: Switch to **Expression** mode, enter: `{{ $json.spreadsheetId }}`
- **Sheet**: Switch to **Expression** mode, enter: `{{ $json.sheetTab }}`
- **Options**: Leave default

#### Node 4: Code — Generate Control Number
- Add a **Code** node, paste this:
```javascript
const inputData = $('Code — Parse Data').first().json;
const existingRows = $input.all();

let targetRow = null;
let lastNum = 0;

for (const item of existingRows) {
  const rowData = item.json;
  const controlCol = rowData['CONTROL #'] || '';
  
  // Track highest control number
  const match = controlCol.match(/(\d+)-(\d+)/);
  if (match) {
    const num = parseInt(match[2], 10);
    if (num > lastNum) lastNum = num;
  }

  // Find first row where SAMPLE is empty (override target)
  const sampleVal = rowData['SAMPLE'] || '';
  if (!targetRow && sampleVal.toString().trim() === '') {
    targetRow = item;
  }
}

// Use existing empty row's control number if available, otherwise generate new
let controlNumber;
if (targetRow) {
  controlNumber = targetRow.json['CONTROL #'] || '';
}
if (!controlNumber) {
  const nextNum = lastNum + 1;
  controlNumber = `${inputData.year}-${String(nextNum).padStart(3, '0')}`;
}

return [{
  json: {
    'CONTROL #': controlNumber,
    'RFAF': inputData.rfaf,
    'MIXING BATCH #': inputData.mixingBatchNo || '',
    'CUC #': inputData.cucNo || '',
    'TYPE': inputData.type,
    'SAMPLE': inputData.sample,
    'SOURCE': inputData.source,
    'QTY': inputData.qty || '',
    'UNIT': inputData.unit || '',
    'DATE RECEIVED/SAMPLED': inputData.dateSampled,
    'TIME': inputData.timeSampled,
    'RECEIVED BY': inputData.receivedBy || '',
    'DATE ANALYZED': inputData.dateAnalyzed || '',
    'ANALYZED BY': inputData.analyzedBy || '',
    'STATUS': 'ON GOING',
  }
}];
```

#### Node 5: Google Sheets — Append or Update Row
- Add a **Google Sheets** node
- **Operation**: Select **"Append or Update"**
- **Document**: Switch to **Expression** mode, enter: `{{ $('Code — Parse Data').first().json.spreadsheetId }}`
- **Sheet**: Switch to **Expression** mode, enter: `{{ $('Code — Parse Data').first().json.sheetTab }}`
- **Column to Match On**: `CONTROL #`
- **Mapping Mode**: **Map Automatically**
- **Options** → **Handling extra fields in input** → **"Ignore"**
- ⚠️ **Data Location on Sheet**: Header Row = `2`, First Data Row = `3`

#### Node 6: Respond to Webhook
- **Response Body** (set as Expression):
```json
{
  "success": true,
  "controlNumber": "{{ $('Code — Generate Control Number').first().json['CONTROL #'] }}"
}
```

---

## Step 5: Create Live Sheet Sync Workflow (Optional)

If you want the mobile app to show real-time history or a live sheet view directly from Google Sheets without leaving the app:

### Overview
```
Webhook (POST) → Google Sheets (Get Rows) → Respond to Webhook
```

### Step-by-step:

#### Node 1: Webhook Trigger
- **HTTP Method**: POST
- **Path**: `get-sheet-data`
- **Response Mode**: Using 'Respond to Webhook' node
- Copy the **Production URL**
- **Authentication**: Set up Header Auth!
  - Under Webhook settings, look for Authentication.
  - Set it to **Header Auth**.
  - Create a new credential with the Name `x-api-key` and the Value matching the `VITE_N8N_API_KEY` defined in your application's `.env` file.

#### Node 2: Google Sheets — Get Existing Rows
- Add a **Google Sheets** node
- **Operation**: Select **"Get row(s) in sheet"**
- **Document**: Switch to **Expression** mode, enter: `{{ $json.body.spreadsheetId }}`
- **Sheet**: Switch to **Expression** mode, enter: `{{ $json.body.sheetTab }}`

#### Node 3: Respond to Webhook
- **Response Body**: Leave as default (`Respond With: First Node Item`)

---

## Step 6: Connect the Web App

1. Copy each workflow's **Production Webhook URL** from n8n
2. Open the SampleLog app → **Settings** page
3. Paste each URL into the corresponding webhook field:
   - ENVI Webhook URL
   - WATER Webhook URL
   - RawMats Webhook URL
   - Sync / Live Sheet URL (if configured)
4. Click **Test** next to each to verify connectivity
5. Click **Save Settings**
6. Ensure that you have a `.env` file in the root of your application with `VITE_N8N_API_KEY=your_secret_key`

---

## Step 7: Testing

### Test with the app:
1. Go to **New Sample** → select a sample type
2. Fill out the form with test data
3. Click **Submit**
4. Check your Google Sheet — the data should appear in the correct tab

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "403 Forbidden" from Google Sheets | Re-authorize Google Sheets credentials in n8n |
| "Sheet not found" | Ensure sheet tab name matches exactly (e.g., "MAY ENVI") |
| Webhook returns 404 | Make sure workflow is **Active** (toggle on in n8n) |
| Webhook returns 401 | Ensure your `VITE_N8N_API_KEY` matches the Header Auth value in n8n |
| Data in wrong columns | Verify column headers in Row 2 match the field names in the Code node |
| Connection timeout | Check n8n is accessible from the internet (or use same network) |

---

## Switching to Official Sheet

When ready to use the official Google Sheet:
1. Open SampleLog → **Settings**
2. Change the Spreadsheet ID from the practice sheet to: `1-pGOoxmZw4qCfK3KnjeRvbK_VbfEAZJUn7GjI01hkXc`
3. Click **Save Settings**
4. Test with a sample submission to verify
