# Next Steps: Finalizing the Integration

The code implementation for Phase 1 through Phase 4 is complete. To make the new features (Offline Control Numbers, Secured Webhooks, and the Live Sheet View) work seamlessly, you must complete the following manual tasks.

## 1. Configure the Frontend Environment Variable

The app now secures all webhook requests by sending an `x-api-key` header. You must define this key.

### Local Development
1. In the root of your project folder (where `package.json` is located), create a new file named `.env` if it doesn't already exist. (You can copy `.env.example` if you have one).
2. Add the following line to the file:
   ```env
   VITE_N8N_API_KEY=your_secure_random_string_here
   ```
   *(Replace `your_secure_random_string_here` with a hard-to-guess password/key).*
3. **Restart your local development server** (`npm run dev`) so it picks up the new variable.

### Production Hosting (e.g., Vercel, Netlify)
1. Go to your hosting provider's dashboard.
2. Navigate to your project's **Environment Variables** settings.
3. Add a new variable:
   - **Key:** `VITE_N8N_API_KEY`
   - **Value:** The exact same secret string you used locally.
4. Trigger a new deployment so the built app includes the key.

---

## 2. Secure Existing n8n Workflows

Your app will now send the API key, so you must tell n8n to require and validate it.

1. Open your n8n web interface.
2. For **each** of your existing workflows (ENVI, WATER, and RawMats):
   - Double-click the first node: **Webhook**.
   - Look for the **Authentication** dropdown and change it from *None* to **Header Auth**.
   - Under *Credential to connect with*, click **Create New Credential**.
   - Set **Name** to exactly: `x-api-key`
   - Set **Value** to the exact secret string you defined in your `.env` file.
   - Save the node and ensure the workflow is **Active**.

---

## 3. Create the New "Live Sheet" n8n Workflow

The new "Live" page in the app requires a new backend endpoint to fetch Google Sheets data.

1. In n8n, click **Add Workflow**.
2. Add a **Webhook** node (Trigger):
   - **HTTP Method:** `POST`
   - **Path:** `get-sheet-data`
   - **Respond:** `Using 'Respond to Webhook' node`
   - **Authentication:** `Header Auth` (select the `x-api-key` credential you created in Step 2).
3. Add a **Google Sheets** node:
   - **Operation:** `Get row(s) in sheet`
   - **Credential:** Select your existing Google Sheets OAuth credential.
   - **Document:** Switch to Expression mode (`=`) and enter: `{{ $json.body.spreadsheetId }}`
   - **Sheet:** Switch to Expression mode (`=`) and enter: `{{ $json.body.sheetTab }}`
4. Add a **Respond to Webhook** node:
   - **Respond With:** `First Node Item` (Leave as default).
5. **Connect** the nodes: Webhook → Google Sheets → Respond to Webhook.
6. **Save** and **Activate** the workflow.
7. Copy the **Production URL** from the Webhook node.

---

## 4. Final App Configuration

1. Open the Sample Logger web app in your browser.
2. Navigate to the **Settings** page.
3. You will see a new input field for the **Live Sheet URL**. Paste the Production URL you copied in Step 3.
4. Click **Test** to ensure it connects properly.
5. Click **Save Settings**.

You are now fully set up! Test the offline queuing by turning off your Wi-Fi, submit a sample, turn Wi-Fi back on, and watch it sync automatically. Then check the new **Live** tab to view your synced data.