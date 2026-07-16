# MoodMile

MoodMile is a React + TypeScript web app for collecting employee mascot name suggestions.

## Features

- Responsive, colorful UI for desktop and mobile
- Sample mascot cards with image, title, and description
- Mascot selection + name suggestion form
- Multiple submissions supported
- Suggestions shown as grouped cards by mascot
- Suggestions persisted in browser local storage
- Voting: each suggestion has an upvote button showing the current vote count
- Vote once per suggestion; click again to revoke your vote
- Votes persisted in browser local storage to prevent duplicate votes
- Leaderboard ordering: suggestions are ranked by vote count within each mascot group

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open the URL printed by Vite (usually `http://localhost:5173`).

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```
