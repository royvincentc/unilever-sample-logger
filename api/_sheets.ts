import { google } from 'googleapis';

/**
 * Shared Google Sheets API client initialized from Vercel environment variables.
 * Expects GOOGLE_CREDENTIALS environment variable containing the stringified Service Account JSON.
 */

let authClient: any = null;

export async function getAuthClient() {
  if (authClient) return authClient;

  let credentialsStr = process.env.GCP_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS;
  
  if (!credentialsStr) {
    try {
      const fs = require('fs');
      const path = require('path');
      const credsPath = path.join(process.cwd(), 'api', 'credentials.json');
      if (fs.existsSync(credsPath)) {
        credentialsStr = fs.readFileSync(credsPath, 'utf8');
      }
    } catch (e) {
      console.warn("Failed to read local credentials.json fallback");
    }
  }

  if (!credentialsStr) {
    throw new Error("Missing GCP_CREDENTIALS_JSON environment variable. Please add your service account JSON as a stringified env variable.");
  }

  try {
    const credentials = JSON.parse(credentialsStr);
    
    authClient = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return authClient;
  } catch (error) {
    console.error("Failed to parse GOOGLE_CREDENTIALS:", error);
    throw new Error("Invalid GOOGLE_CREDENTIALS format. Must be valid JSON.");
  }
}

export async function getSheetsClient() {
  const auth = await getAuthClient();
  return google.sheets({ version: 'v4', auth });
}
