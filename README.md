# UL Sample Logger

A mobile-first sample logging application developed around QC microbiology workflows in the Philippines. It helps staff capture sample information, queue submissions on a device, and work with an existing Google Sheets logbook.

**Application:** [ulmicro.vercel.app](https://ulmicro.vercel.app) — operational deployment; access and available features depend on its configuration.

## The problem

Laboratory staff need to record samples from the point of collection, often using a phone and an unreliable connection. Spreadsheet layouts, sample categories, control numbers, and prefilled rows make this more involved than submitting a generic web form.

This project brings those workflows into a dedicated interface while retaining Google Sheets as the operational logbook.

## Core capabilities

- Mobile sample intake for environmental, water, air, and raw-material workflows.
- Control-number preparation using category-specific rules and available sheet or history data.
- An IndexedDB submission queue with queued, sending, failed, and successful states.
- Single and bulk submissions through a Vercel API, with support for updating existing sheet rows.
- Shared sample history through Firebase Firestore and a server-side sample mirror in Supabase when configured.
- Shared Kanban boards and Excalidraw drawings, with separate Google sign-in and workspace configuration.
- Drive checkpoints for shared resources when the required credentials and destination are configured.

These describe the checked-in implementation. Cloud-dependent features require their own deployment setup and verification.

## Current architecture

The sample submission path uses Vercel serverless functions. The n8n workflows in this repository document an earlier implementation.

```text
React + TypeScript interface
  ├─ IndexedDB: local submission queue
  ├─ Firebase Auth / Firestore: app identity and sample history
  └─ Vercel API
       ├─ /api/sheet-data: sheet reads and control-number lookup
       └─ /api/submit: sample writes and updates
            ├─ Google Sheets: operational logbook
            └─ Supabase: sample mirror, when configured

Shared boards and drawings
  └─ Google OAuth + Vercel collaboration API
       ├─ Supabase PostgreSQL: shared resource state
       └─ Google Drive: configured checkpoints and exports
```

Shared-board identity is separate from Firebase-based parts of the sample logger. Drive exports are checkpoints; they are not the authoritative live collaboration database.

## Submission and recovery behavior

The client prepares a control number and sends the sample payload to `/api/submit`. The handler maps values to sheet headers, looks for a matching row, and writes or updates Google Sheets. It returns the submitted control number; it does not allocate a new number through an atomic server-side sequence.

Queued submissions can be retried. After an acknowledged success, the queue stores the accepted state before saving history and removing the item. If history saving fails, that accepted queue record is retained, and the normal retry-all path excludes successful items.

Offline capture and queuing do not make every feature available without a connection. Sheet reads, submissions, and cloud collaboration require network access. Clearing browser storage can remove locally queued records.

### Current boundaries

- Control-number lookup and sheet writing are separate operations. This README does not claim collision-free numbering under concurrent submissions.
- Google Sheets, Firestore history, and the Supabase mirror are separate persistence paths, not one transaction. A successful sheet response does not establish that every copy is synchronized.
- Moving credentials to a server does not by itself establish user authorization for every API route. Verify access controls for the intended deployment.
- The application supports record handling; this repository does not establish regulatory validation or approval for a laboratory's intended use.

## Technology

| Area | Tools |
| --- | --- |
| Interface | React, TypeScript, Vite, Tailwind CSS |
| API and hosting | Vercel functions, Google APIs |
| Local queue | IndexedDB through `idb` |
| Identity and history | Firebase Auth, Firestore |
| Shared workspace | Google OAuth, Supabase PostgreSQL, Yjs |
| Drawing and exports | Excalidraw, Google Drive |

## Local development

Install dependencies:

```sh
npm ci
```

For the interface, run:

```sh
npm run dev
```

For local serverless API development, run the following in a separate terminal with the Vercel CLI available:

```sh
npm run dev:api
```

Vite proxies API requests to port 3000. Live integrations require approved development configuration; starting Vite alone does not configure Google Sheets, Firebase, Supabase, or Drive.

### Configuration

- Review [`.env.example`](.env.example), [the Sheets credential helper](api/_sheets.ts), and [the collaboration setup guide](docs/COLLABORATION_HANDOFF.md).
- Sheets access uses server-only `GCP_CREDENTIALS_JSON` or `GOOGLE_CREDENTIALS` containing service-account JSON. The development spreadsheet must grant that account the required access.
- Firebase project configuration is currently in [`src/utils/firebase.ts`](src/utils/firebase.ts). Review it before running an independent deployment.
- Shared resources require database migrations, Google OAuth, workspace settings, and separate Drive configuration as described in the collaboration guide.
- The `VITE_N8N_API_KEY` entry in `.env.example` belongs to the earlier webhook setup; the current sample submission client calls `/api/submit`.
- Keep service-account credentials, OAuth secrets, service-role keys, and refresh tokens on the server. `VITE_` variables are exposed to the browser.

Use synthetic records and dedicated development resources. Do not commit operational laboratory records or private credentials.

## Available checks

```sh
npm test
npm run typecheck:api
npm run build
npm run test:e2e
```

These are repository check commands, not a claim that they have passed on your machine or against live services. Browser checks require the browser and fixture setup described in the collaboration guide.

## Repository guide

- [`src/`](src/) — interface, sample forms, local queue, and shared-resource clients.
- [`api/`](api/) — Vercel functions and server integration helpers.
- [`tests/`](tests/) — automated checks.
- [Collaboration handoff](docs/COLLABORATION_HANDOFF.md) — shared boards, drawings, configuration, and recorded verification limits.
- [`n8n-workflows/`](n8n-workflows/) — historical automation workflows and setup material.

## Author

Built by [Roy Vincent Codiñera](https://github.com/royvincentc), a Registered Medical Technologist and QC microbiologist developing software for laboratory workflows.

Related project: [IPI QC Microbiology Workspace](https://github.com/royvincentc/ipi-qc-workspace).
