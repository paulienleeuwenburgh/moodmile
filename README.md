# MoodMile

MoodMile is a generic polling app built with React + TypeScript. Campaigns and questions are configured in Azure Table Storage, so new polls can be added without code changes.

## Features

- Responsive, colorful UI for desktop and mobile
- Mascot cards with image, title, and description
- Mascot selection + name suggestion form
- Multiple submissions supported
- Suggestions shown as grouped cards by question
- Suggestions persisted in **Azure Table Storage** (shared across all users)
- Voting: each suggestion has an upvote button showing the current vote count
- Configurable vote limits per session (total, per-category, per-candidate)
- Leaderboard ordering: suggestions are ranked by vote count within each question group
- Backend API built with **Azure Functions** (no storage keys exposed to the browser)
- Campaigns and questions are data-driven: configured in Azure Table Storage without code changes
- Multiple campaigns can run in parallel, each accessed by its own URL
- Default ninja-naming campaign is seeded automatically on first request

## Campaign URLs

Each campaign is accessed via a unique URL:

```
/c/{campaignId}
```

**Examples:**
- `/c/ninja-naming` — the default ninja mascot-naming campaign
- `/c/best-padeller-2026` — vote for the best padeller of 2026

There is **no public campaign selector or overview page by design**. Access is controlled by knowing the campaign URL. Share the URL with participants — if you have the link, you can participate.

- The root `/` redirects to `/c/ninja-naming` to preserve default behaviour.
- Navigating to `/c/{id}` for a campaign that does not exist shows a friendly "Campaign not found" message.

## Architecture

```
Browser (React + Vite)
  └── /api/*  ──►  Azure Functions (Node.js)
                        └──►  Azure Table Storage
                                  ├── campaigns    (campaign configuration)
                                  ├── questions    (questions per campaign)
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
| Table: `campaigns` | Created automatically; seeded with ninja-naming on first request |
| Table: `questions` | Created automatically; seeded with ninja questions on first request |
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

## Azure Table Storage schema

### `campaigns` table

Stores campaign configuration. Each row is one campaign.

| Property | Type | Notes |
|---|---|---|
| `PartitionKey` | string | Always `"campaign"` |
| `RowKey` | string | `campaignId` (e.g. `ninja-naming`) |
| `title` | string | Displayed as the page heading |
| `description` | string | Displayed below the heading |
| `status` | string | `"active"` or `"closed"` |
| `allowSuggestions` | bool | Whether users can submit new suggestions |
| `maxVotesTotal` | int | Max votes per session across the whole campaign (0 = unlimited) |
| `maxVotesPerCategory` | int | Max votes per session within one question (0 = unlimited) |
| `maxVotesPerCandidate` | int | Max votes per session for a single suggestion (0 = unlimited) |
| `createdAt` | string | ISO 8601 timestamp |
| `updatedAt` | string | ISO 8601 timestamp |

### `questions` table

Stores questions (categories) for a campaign. Each row is one question.

| Property | Type | Notes |
|---|---|---|
| `PartitionKey` | string | `campaignId` (e.g. `ninja-naming`) — groups questions by campaign |
| `RowKey` | string | `questionId` (e.g. `ninja-1`) |
| `title` | string | Displayed on the question card and in suggestion groups |
| `description` | string | Short description shown on the question card |
| `imageUrl` | string | Optional. Path to question image (e.g. `/mascots/ninja1.png`). Leave empty for no image — the card renders gracefully without one. |
| `sortOrder` | int | Questions are sorted ascending by this value |
| `createdAt` | string | ISO 8601 timestamp |
| `updatedAt` | string | ISO 8601 timestamp |

### `suggestions` table

Stores name suggestions submitted by users.

| Property | Type | Notes |
|---|---|---|
| `PartitionKey` | string | `"{campaignId}\|{questionId}"` |
| `RowKey` | string | Suggestion UUID |
| `campaignId` | string | Campaign this suggestion belongs to |
| `questionId` | string | Question this suggestion belongs to |
| `name` | string | The suggested name |
| `createdAt` | string | ISO 8601 timestamp |
| `votes` | int | Running vote count |

### `votes` table

Tracks which suggestions each browser session has voted for.

| Property | Type | Notes |
|---|---|---|
| `PartitionKey` | string | `"{campaignId}\|{sessionId}"` |
| `RowKey` | string | `suggestionId` (or `"{suggestionId}\|{uuid}"` for multi-vote campaigns) |
| `questionId` | string | Question the voted suggestion belongs to |
| `suggestionId` | string | The suggestion that was voted for |
| `createdAt` | string | ISO 8601 timestamp |

## Default ninja campaign seeding

On the first request to `GET /api/campaign?campaignId=ninja-naming`, the backend checks whether the `ninja-naming` campaign exists in the `campaigns` table. If it does not, it seeds:

**Campaign:**
- `campaignId`: `ninja-naming`
- `title`: These four ninjas need names
- `status`: active, `allowSuggestions`: true
- `maxVotesTotal`: 4, `maxVotesPerCategory`: 1, `maxVotesPerCandidate`: 1

**Questions:** Ninja 1–4, each with an image from `/public/mascots/ninja{1-4}.png`

Seeding uses `upsertEntity` (Replace mode) so concurrent cold-starts are safe.

## Creating a new campaign

New polls can be created by inserting rows directly into Azure Table Storage — no code changes required. Multiple active campaigns can exist simultaneously; each is accessed at its own `/c/{campaignId}` URL.

### Example: ninja-naming (default, seeded automatically)

**Campaign row** (`campaigns` table):

| Field | Value |
|---|---|
| PartitionKey | `campaign` |
| RowKey | `ninja-naming` |
| title | `These four ninjas need names` |
| status | `active` |
| allowSuggestions | `true` |
| maxVotesTotal | `4` |
| maxVotesPerCategory | `1` |
| maxVotesPerCandidate | `1` |

**Question rows** (`questions` table):

| PartitionKey | RowKey | title | imageUrl | sortOrder |
|---|---|---|---|---|
| `ninja-naming` | `ninja-1` | Ninja 1 | `/mascots/ninja1.png` | 1 |
| `ninja-naming` | `ninja-2` | Ninja 2 | `/mascots/ninja2.png` | 2 |
| `ninja-naming` | `ninja-3` | Ninja 3 | `/mascots/ninja3.png` | 3 |
| `ninja-naming` | `ninja-4` | Ninja 4 | `/mascots/ninja4.png` | 4 |

Accessible at: **`/c/ninja-naming`**

### Example: best-padeller-2026

**Campaign row** (`campaigns` table):

| Field | Value |
|---|---|
| PartitionKey | `campaign` |
| RowKey | `best-padeller-2026` |
| title | `Best Padeller 2026` |
| description | `Nominate and vote for the best padeller of 2026.` |
| status | `active` |
| allowSuggestions | `true` |
| maxVotesTotal | `3` |
| maxVotesPerCategory | `3` |
| maxVotesPerCandidate | `2` |

**Question row** (`questions` table):

| PartitionKey | RowKey | title | description | imageUrl | sortOrder |
|---|---|---|---|---|---|
| `best-padeller-2026` | `nominees` | Who do you nominate? | Suggest and vote for your favourite padeller. | *(empty)* | 1 |

> **Note on imageUrl:** Leave `imageUrl` empty for questions without an image — the card renders gracefully without one. For now, you can point `imageUrl` at existing files in the `/public/mascots/` directory (e.g. `/mascots/ninja1.png`). Image upload and Blob Storage are planned for a future release.

Accessible at: **`/c/best-padeller-2026`**

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/campaign?campaignId=X` | Returns the campaign with the given ID (404 if not found). Seeds the default ninja campaign if it does not exist yet. |
| `GET` | `/api/questions?campaignId=X` | Returns questions for a campaign, sorted by `sortOrder` |
| `GET` | `/api/suggestions?campaignId=X` | Returns all suggestions for a campaign |
| `POST` | `/api/suggestions` | Submit a new suggestion |
| `GET` | `/api/votes?campaignId=X&sessionId=Y` | Returns vote counts per suggestion `{ [suggestionId]: count }` for this session |
| `POST` | `/api/votes` | Cast or revoke a vote |

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
# Navigate to http://localhost:5173/c/ninja-naming
```

## Build

```bash
# Frontend
npm run build

# API (compile TypeScript → dist/)
cd api && npm run build
```

## Test

```bash
# Frontend + API unit tests
npm test

# API tests only
cd api && npm test
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

The `staticwebapp.config.json` at the root configures a navigation fallback so all `/c/*` routes
are served by `index.html`, letting React Router handle campaign-specific routing client-side.

## Verify in a PR preview

1. Open the PR preview URL
2. Navigate to `/c/ninja-naming` — the ninja campaign should load (seeded automatically on first request)
3. Verify: four ninja question cards are displayed
4. Verify: suggestions and voting work
5. Navigate to `/c/best-padeller-2026` (after creating that campaign in Table Storage) — the padeller campaign should load independently
6. Navigate to `/c/does-not-exist` — a "Campaign not found" message should be shown
7. Navigate to `/` — the app should redirect to `/c/ninja-naming`
8. To confirm storage-loading (not static data), check the Azure Functions logs — you should see requests to `GET /api/campaign?campaignId=ninja-naming` and `GET /api/questions?campaignId=ninja-naming`


## Architecture

```
Browser (React + Vite)
  └── /api/*  ──►  Azure Functions (Node.js)
                        └──►  Azure Table Storage
                                  ├── campaigns    (campaign configuration)
                                  ├── questions    (questions per campaign)
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
| Table: `campaigns` | Created automatically; seeded with ninja-naming on first request |
| Table: `questions` | Created automatically; seeded with ninja questions on first request |
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

## Azure Table Storage schema

### `campaigns` table

Stores campaign configuration. Each row is one campaign.

| Property | Type | Notes |
|---|---|---|
| `PartitionKey` | string | Always `"campaign"` |
| `RowKey` | string | `campaignId` (e.g. `ninja-naming`) |
| `title` | string | Displayed as the page heading |
| `description` | string | Displayed below the heading |
| `status` | string | `"active"` or `"closed"`. Only active campaigns are served |
| `allowSuggestions` | bool | Whether users can submit new suggestions |
| `maxVotesTotal` | int | Max votes per session across the whole campaign (0 = unlimited) |
| `maxVotesPerCategory` | int | Max votes per session within one question (0 = unlimited) |
| `maxVotesPerCandidate` | int | Max votes per session for a single suggestion (0 = unlimited) |
| `createdAt` | string | ISO 8601 timestamp |
| `updatedAt` | string | ISO 8601 timestamp |

### `questions` table

Stores questions (categories) for a campaign. Each row is one question.

| Property | Type | Notes |
|---|---|---|
| `PartitionKey` | string | `campaignId` (e.g. `ninja-naming`) — groups questions by campaign |
| `RowKey` | string | `questionId` (e.g. `ninja-1`) |
| `title` | string | Displayed on the question card and in suggestion groups |
| `description` | string | Short description shown on the question card |
| `imageUrl` | string | Optional. Path to question image (e.g. `/mascots/ninja1.png`) |
| `sortOrder` | int | Questions are sorted ascending by this value |
| `createdAt` | string | ISO 8601 timestamp |
| `updatedAt` | string | ISO 8601 timestamp |

### `suggestions` table

Stores name suggestions submitted by users.

| Property | Type | Notes |
|---|---|---|
| `PartitionKey` | string | `"{campaignId}\|{questionId}"` |
| `RowKey` | string | Suggestion UUID |
| `campaignId` | string | Campaign this suggestion belongs to |
| `questionId` | string | Question this suggestion belongs to |
| `name` | string | The suggested name |
| `createdAt` | string | ISO 8601 timestamp |
| `votes` | int | Running vote count |

### `votes` table

Tracks which suggestions each browser session has voted for.

| Property | Type | Notes |
|---|---|---|
| `PartitionKey` | string | `"{campaignId}\|{sessionId}"` |
| `RowKey` | string | `suggestionId` (or `"{suggestionId}\|{uuid}"` for multi-vote campaigns) |
| `questionId` | string | Question the voted suggestion belongs to |
| `suggestionId` | string | The suggestion that was voted for |
| `createdAt` | string | ISO 8601 timestamp |

## Default ninja campaign seeding

On the first request to `GET /api/campaign`, the backend checks whether the `ninja-naming`
campaign exists in the `campaigns` table. If it does not, it seeds:

**Campaign:**
- `campaignId`: `ninja-naming`
- `title`: These four ninjas need names
- `status`: active, `allowSuggestions`: true
- `maxVotesTotal`: 4, `maxVotesPerCategory`: 1, `maxVotesPerCandidate`: 1

**Questions:** Ninja 1–4, each with an image from `/public/mascots/ninja{1-4}.png`

Seeding uses `upsertEntity` (Replace mode) so concurrent cold-starts are safe.

## Configuring a new campaign

New polls can be created by inserting rows directly into Azure Table Storage — no code changes required.

### Example: "Best padeller"

Insert into the **campaigns** table:

| Field | Value |
|---|---|
| PartitionKey | `campaign` |
| RowKey | `best-padeller` |
| title | `Who is the best padeller?` |
| description | `Vote for your favourite padel player!` |
| status | `active` |
| allowSuggestions | `false` |
| maxVotesTotal | `3` |
| maxVotesPerCategory | `1` |
| maxVotesPerCandidate | `1` |
| createdAt / updatedAt | ISO timestamp |

Insert into the **questions** table (one row per player):

| PartitionKey | RowKey | title | sortOrder |
|---|---|---|---|
| `best-padeller` | `player-1` | Alice | 1 |
| `best-padeller` | `player-2` | Bob | 2 |

> **Note**: Set the `ninja-naming` campaign `status` to `closed` to hide it from the app once a new active campaign is running.

### Example: "Where should we eat next week?"

Insert into the **campaigns** table:

| Field | Value |
|---|---|
| PartitionKey | `campaign` |
| RowKey | `lunch-vote-2025-w30` |
| title | `Where should we eat next week?` |
| description | `Suggest and vote for your favourite lunch spot.` |
| status | `active` |
| allowSuggestions | `true` |
| maxVotesTotal | `2` |
| maxVotesPerCategory | `2` |
| maxVotesPerCandidate | `1` |
| createdAt / updatedAt | ISO timestamp |

Insert into the **questions** table (one row per day or one global "lunch" category):

| PartitionKey | RowKey | title | sortOrder |
|---|---|---|---|
| `lunch-vote-2025-w30` | `monday` | Monday | 1 |
| `lunch-vote-2025-w30` | `tuesday` | Tuesday | 2 |
| `lunch-vote-2025-w30` | `wednesday` | Wednesday | 3 |

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/campaign` | Returns the active campaign (seeds default if none exists) |
| `GET` | `/api/questions?campaignId=X` | Returns questions for a campaign, sorted by `sortOrder` |
| `GET` | `/api/suggestions?campaignId=X` | Returns all suggestions for a campaign |
| `POST` | `/api/suggestions` | Submit a new suggestion |
| `GET` | `/api/votes?campaignId=X&sessionId=Y` | Returns suggestion IDs voted for by this session |
| `POST` | `/api/votes` | Cast or revoke a vote |

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

## Test

```bash
# Frontend + API unit tests
npm test

# API tests only
cd api && npm test
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

## Verify in a PR preview

1. Open the PR preview URL
2. The app should load and show the ninja-naming campaign (seeded automatically on first request)
3. Verify: four ninja question cards are displayed
4. Verify: suggestions and voting work
5. To confirm storage-loading (not static data), check the Azure Functions logs — you should see requests to `GET /api/campaign` and `GET /api/questions?campaignId=ninja-naming`
