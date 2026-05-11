# Task Implementation Plan and Code Audit

## 1. Task Description
Enhance the offline capabilities, performance, and security of the "UL Sample Logger" application, ensuring it aligns tightly with the automated workflow defined in n8n and Google Sheets.

## 2. Refined Findings & Strategy (Based on Design Intent)

### A. Offline Control Number Logic
**The Current State:** When offline, the app currently defaults to generating `-001` for the sequence because it cannot see the latest control number in Google Sheets.
**The Fix:** 
1. **Frontend:** We need to update `generateNextControlNumber` to leverage the local Firebase/IndexedDB `history` cache to find the highest control number logged locally. If no local history exists, it can safely start at `-001`.
2. **n8n Backend (The Source of Truth):** n8n is already written to calculate the control number itself! However, we need to ensure that when a queued item eventually syncs, the frontend updates its local history with the *final* control number n8n generated, not the placeholder it generated offline.

### B. Security Improvements
1. **API Keys for n8n Webhooks:** We will add a simple API Key header requirement in the n8n workflows (`x-api-key`) and pass this key from the React frontend as an environment variable (`VITE_N8N_API_KEY`).
2. **Credentials Management:** Move the sensitive credentials out of `src/data/constants.ts` and `Settings.tsx` into a more secure, build-time environment setup.

### C. n8n Scalability Bottleneck
**The Current State:** The n8n "Get existing rows" node pulls the *entire* sheet every time.
**The Fix:** We will optimize the n8n workflow guide. Since the sheet is categorized by month (e.g., `MAY ENVI`), we can configure the n8n node to only fetch the `CONTROL #` column (Column A) or limit the search, drastically reducing the payload size. Alternatively, we can rely on n8n to only pull the last X rows if the workflow allows it.

## 3. Implementation Phases

### Phase 1: Fix Offline Control Numbers (Priority 1)
1. **Update `src/utils/db.ts` & `src/utils/controlNumber.ts`:**
   - Create a helper to query the local `history` object store for the highest sequence number matching the requested `sampleType` and date.
   - Inject this highest number into `generateNextControlNumber` when offline.
2. **Update `src/pages/NewSample.tsx`:**
   - When a queued item finally succeeds via `sendToWebhook`, ensure the returned `result.controlNumber` from n8n updates the local history entry.

### Phase 2: Implement Webhook Authentication (Priority 2)
1. **Update Frontend (`api.ts`):** Inject `x-api-key: import.meta.env.VITE_N8N_API_KEY` into the webhook headers.
2. **Update Documentation (`SETUP_GUIDE.md`):** Add instructions to add a "Header Auth" or "Header validation" step in the n8n webhook nodes.

### Phase 3: Error Handling & Cleanup
1. Ensure Firebase offline persistence is robust and UI surfaces offline/online state cleanly.

### Phase 4: Mobile-Friendly Live Sheet View (New Feature)
**The Goal:** Provide a read-only, mobile-friendly page within the app that reflects the live data currently in Google Sheets, eliminating the need to open the Google Sheets app to verify submissions.
**The Fix:**
1. **n8n Backend:** Create a new webhook workflow in n8n (e.g., `/webhook/get-sheet-data`) that accepts a requested sheet tab/month and returns the rows as JSON.
2. **Frontend:** Create a new page (e.g., `LiveSheetView.tsx`) with a mobile-optimized card layout (instead of a wide table) to display the fetched records. Add a refresh button to pull the latest live data.

## 4. Open Questions
- None at this time, proceeding to Phase 1 based on user confirmation.