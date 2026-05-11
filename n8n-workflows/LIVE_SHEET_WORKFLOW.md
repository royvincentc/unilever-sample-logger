# Live Sheet n8n Workflow

You can copy the entire JSON code block below. 
In your n8n workflow canvas, simply press **Ctrl+V** (or Cmd+V on Mac) to paste it. n8n will automatically translate this JSON into nodes and connect them for you.

```json
{
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "get-sheet-data",
        "responseMode": "responseNode",
        "options": {}
      },
      "id": "1a2b3c4d-5e6f-7g8h-9i0j-1234567890ab",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [
        200,
        300
      ]
    },
    {
      "parameters": {
        "documentId": {
          "__rl": true,
          "value": "={{ $json.body.spreadsheetId }}",
          "mode": "id"
        },
        "sheetName": {
          "__rl": true,
          "value": "={{ $json.body.sheetTab }}",
          "mode": "id"
        },
        "options": {}
      },
      "id": "2b3c4d5e-6f7g-8h9i-0j1k-2345678901bc",
      "name": "Google Sheets",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4,
      "position": [
        420,
        300
      ]
    },
    {
      "parameters": {
        "respondWith": "allIncomingItems",
        "options": {}
      },
      "id": "3c4d5e6f-7g8h-9i0j-1k2l-3456789012cd",
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [
        640,
        300
      ]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Google Sheets",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Sheets": {
      "main": [
        [
          {
            "node": "Respond to Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

### Next Steps After Pasting:
1. **Double-click the Webhook node:** Change the Authentication dropdown to **Header Auth** and select the `x-api-key` credential you created earlier.
2. **Double-click the Google Sheets node:** At the very top of the settings, select your existing **Google Sheets OAuth2 API** credential so the node has permission to read the sheet.
3. Save, activate the workflow, grab the Production Webhook URL, and paste it into the app's settings!