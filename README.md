# MoodMile

MoodMile is a React + TypeScript web app for collecting employee mascot name suggestions.

## Features

- Responsive, colorful UI for desktop and mobile
- Sample mascot cards with image, title, and description
- Mascot selection + name suggestion form
- Multiple submissions supported
- Suggestions shown as grouped cards by mascot
- Suggestions persisted in **Azure Table Storage** (shared across all users)
- Voting: each suggestion has an upvote button showing the current vote count
- Vote once per suggestion (tracked per browser session); click again to revoke your vote
- Leaderboard ordering: suggestions are ranked by vote count within each mascot group
- Backend API built with **Azure Functions** (no storage keys exposed to the browser)

## Architecture

```
Browser (React + Vite)
  └── /api/*  ──►  Azure Functions (Node.js)
                        └──►  Azure Table Storage
                                  ├── suggestions  (mascot name suggestions)
                                  └── votes        (per-session vote tracking)
```

The browser never communicates directly with Azure Storage. All storage operations go through
the Azure Functions backend. The only thing stored in the browser is an anonymous session ID
(used to track which suggestions the current user has voted on).

## Azure Configuration

### Required Azure resources

| Resource | Details |
|---|---|
| Azure Storage Account | General-purpose v2 (or v1) |
| Table: `suggestions` | Created automatically on first write |
| Table: `votes` | Created automatically on first write |
| Azure Functions App | Node.js 20+, v4 programming model |

### Environment variables (Azure Functions)

Set these in **Configuration > Application settings** on the Azure Functions App (or in
`api/local.settings.json` for local development — see below):

| Variable | Description |
|---|---|
| `AZURE_STORAGE_CONNECTION_STRING` | Full connection string from Storage Account → Access keys. **Preferred.** |
| `AZURE_STORAGE_ACCOUNT_NAME` + `AZURE_STORAGE_ACCOUNT_KEY` | Alternative if you prefer named key auth instead of a connection string. |

If `AZURE_STORAGE_CONNECTION_STRING` is present it takes priority over the named-key pair.

## Run locally

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local)
- An Azure Storage Account **or** [Azurite](https://learn.microsoft.com/azure/storage/common/storage-use-azurite) (local emulator)

### 1. Install all dependencies

```bash
npm install
cd api && npm install && cd ..
```

### 2. Configure the API

Copy the example settings file and fill in your connection string:

```bash
cp api/local.settings.json.example api/local.settings.json
# Edit api/local.settings.json and set AZURE_STORAGE_CONNECTION_STRING
```

To use Azurite instead of a real storage account, leave `AzureWebJobsStorage` as
`"UseDevelopmentStorage=true"` and set `AZURE_STORAGE_CONNECTION_STRING` to
`"UseDevelopmentStorage=true"` as well.

### 3. Start the Azure Functions backend

```bash
cd api && npm start
# Functions will listen on http://localhost:7071
```

### 4. Start the Vite dev server

In a second terminal:

```bash
npm run dev
# Opens http://localhost:5173
# Requests to /api/* are proxied to http://localhost:7071
```

## Build

```bash
# Frontend
npm run build

# API (compile TypeScript → dist/)
cd api && npm run build
```

## Lint

```bash
npm run lint
```

## Deploy to Azure Static Web Apps

Azure Static Web Apps automatically integrates a Vite frontend with an `api/` Azure Functions
folder. Set the following in your SWA configuration:

- **App location**: `/`
- **API location**: `api`
- **Output location**: `dist`

Add `AZURE_STORAGE_CONNECTION_STRING` as an **application setting** in the Static Web App
configuration (portal → Settings → Configuration → Application settings).
