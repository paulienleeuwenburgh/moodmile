# Admin Guide

The admin panel provides lightweight campaign management without requiring Entra ID authentication.

---

## Setup

### 1. Configure the admin secret

Add `ADMIN_SECRET` to your Azure Functions application settings (or `local.settings.json` for local development):

```json
{
  "Values": {
    "ADMIN_SECRET": "<your-secret-value>"
  }
}
```

- Choose a strong random string (e.g. `openssl rand -base64 32`).
- Store it securely — treat it as a shared API key.
- If `ADMIN_SECRET` is not configured, all admin API routes return `501 Not Implemented`.

### 2. Access the admin panel

Navigate to `/admin` in the app. Enter the admin secret in the password field, enter a Campaign ID, and click **Load campaign**.

On success, a green **"Admin access granted"** banner appears at the top, showing the campaign title and a **Logout** button that clears the secret from browser memory.

> **Security note:** The secret is kept in React component state only. It is never written to `localStorage`, cookies, or sent in GET requests. HTTPS is enforced by Azure Static Web Apps for all traffic.

---

## Admin panel overview

### Authentication state

| State | Indicator |
|---|---|
| Unauthenticated | Login form visible |
| Authenticated | Green banner: "Admin access granted — Campaign: \<title\>" + Logout button |

The **Logout** button clears the secret and all campaign data from memory and returns the UI to the login form.

### Campaign summary

After loading a campaign, a summary panel shows:

| Field | Description |
|---|---|
| Status | Current campaign status (`draft`, `active`, `closed`) |
| Active candidates | Number of non-deleted candidates |
| Deleted candidates | Number of soft-deleted candidates (highlighted when > 0) |
| Total votes cast | Sum of all vote counts across active and deleted candidates |
| Last modified | `updatedAt` timestamp from the campaign row (if set) |

This gives the admin an at-a-glance picture of campaign state before taking any action.

---

## Admin actions

### Delete a candidate (soft delete)

- **Effect:** The candidate is hidden from the suggestion board and leaderboard. It no longer appears in voting.
- **Votes:** Existing votes for this candidate are **preserved** in storage. The vote count remains on the candidate row for audit purposes.
- **Vote budget:** While the candidate remains deleted, votes previously cast for it **do not count against** the voter's remaining budget. The voter regains that budget immediately.
- **Metadata fields stored:**
  - `isDeleted`: `true`
  - `deletedAt`: ISO timestamp
  - `deletedBy`: admin identifier (optional, entered in the UI)
  - `deleteReason`: reason (optional, entered in the UI)
- **Confirmation dialog:** Shows candidate name, question, current vote count, and notes that votes are preserved.
- **Reversible:** Yes — see *Restore a candidate* below.

### Restore a candidate

- **Effect:** The candidate reappears in the suggestion board, leaderboard, and voting immediately.
- **Votes:** The original vote count is restored intact.
- **Voting:** Users can vote for or revoke votes on the candidate again as normal.
- **Note:** Restoring a candidate re-activates its preserved votes immediately. Those votes count against users' budgets again, which may reduce a voter's remaining budget or leave them temporarily over budget until they revoke active votes.
- **Confirmation dialog:** Shows candidate name, question, vote count that will be restored. Confirm button is green to signal this is a safe operation.

### Reset campaign votes

- **Affects:** All vote rows for the campaign are deleted. Every candidate's vote counter is reset to `0`.
- **Preserved:** All candidates (active and soft-deleted) remain intact.
- **Confirmation dialog:** Lists what is affected and what is preserved. Cannot be undone.

### Reset campaign candidates

- **Affects:** All active (non-deleted) candidates are soft-deleted. All votes are also removed.
- **Preserved:** Campaign settings (title, status, voting rules) are unchanged. Soft-deleted candidates can be restored individually.
- **Vote history:** Soft-deleted candidates retain their rows in storage. Vote rows are deleted.
- **Reason for soft delete (not hard delete):** Keeping candidate rows means the suggestion IDs in historical vote rows remain resolvable. Hard-deleting candidates would leave orphaned vote row keys, making audit data unexplainable.
- **Confirmation dialog:** Displays the count of candidates that will be affected and notes that votes cannot be recovered.

### Full campaign reset

- **Affects:** All votes are deleted and all candidates are soft-deleted.
- **Preserved:** Campaign configuration (title, status, and voting rules) is untouched.
- **Safety requirement:** The admin must type the exact campaign ID in the confirmation dialog before the confirm button becomes active. This prevents accidental data loss.
- **Confirmation dialog:** Prominently warns this is the most destructive operation available. Requires typing the campaign ID.

---

## Deleted candidates

The **Deleted candidates** section displays:

| Column | Description |
|---|---|
| Category | Question/category the candidate belongs to |
| Candidate | Candidate name |
| Votes | Vote count at time of deletion (preserved for audit) |
| Deleted at | Full date and time of deletion |
| Deleted by | Admin identifier who deleted the candidate (if provided) |
| Reason | Deletion reason (if provided) |
| Action | **Restore** button (green) |

Soft-deleted candidates are hidden from voters but kept in storage for audit purposes. Vote counts are preserved even while deleted.

---

## Operational clarity

Each action card in the admin panel shows:
- **Affects:** what data will be changed or deleted.
- **Preserved:** what data is kept intact.

Visual hierarchy by risk level:

| Risk | Styling | Examples |
|---|---|---|
| Low (restore) | Green button | Restore candidate |
| Medium (delete) | Red-outline button | Delete candidate, Reset votes, Reset candidates |
| High (full reset) | Red-background button + warning card | Full campaign reset |

---

## Status transition rules

| From | To | Allowed | Notes |
|---|---|---|---|
| `draft` | `active` | ✅ | Starts the campaign; voting begins |
| `active` | `closed` | ✅ | Ends the campaign; no new votes |
| `closed` | `active` | ✅ | Re-opens the campaign |
| `draft` | `closed` | ✅ | Skip active phase (e.g. cancelled) |
| `active` | `draft` | ⚠️ | Not recommended; campaign was already visible |
| `closed` | `draft` | ⚠️ | Not recommended |

Status transitions are not enforced by the API — any valid status string is accepted. The table above reflects recommended operational practice.

---

## Deleted candidates and rankings

- Soft-deleted candidates are **excluded** from `GET /api/suggestions` responses and are not shown in the voting UI, suggestion board, or leaderboard.
- The leaderboard rank of remaining candidates adjusts automatically once a candidate is deleted (since they are simply absent from the sorted list).
- Restoring a candidate re-inserts it into the leaderboard at the position its vote count earns.

---

## Behaviour when voting rules change after votes exist

Changing vote limits after votes have been cast does **not** retroactively invalidate existing votes:
- If limits are **tightened**, users who already voted above the new limit cannot cast more votes; existing votes are preserved.
- If limits are **relaxed**, users may cast additional votes up to the new limit.

---

## Error messages

The admin panel maps API error codes to specific messages:

| Situation | Message shown |
|---|---|
| Wrong admin secret | "Invalid admin secret. Please check your credentials and try again." |
| `ADMIN_SECRET` not configured | "Admin access is not configured on this server. Contact your administrator." |
| Campaign ID not found | "Campaign not found. Please check the Campaign ID and try again." |
| Server error (5xx) | "Unexpected server error. Please try again later." |
| Network failure | "API unavailable. Please check your connection and try again." |
| Other API errors | The server's error message is shown directly |

---

## API reference

All admin routes require the `X-Admin-Secret: <secret>` header.

> **Note:** The route prefix `mgmt/` (not `admin/`) is used because Azure Functions reserves the
> `admin/` prefix for its built-in host management API. Any HTTP trigger with a route starting
> with `admin/` is intercepted by the Functions runtime and never reaches user-defined handlers.

| Method | Route | Action |
|---|---|---|
| `GET` | `/api/mgmt/suggestions?campaignId=X` | List soft-deleted candidates for a campaign |
| `DELETE` | `/api/mgmt/suggestions` | Soft-delete a candidate (body: `{ campaignId, questionId, suggestionId, deletedBy?, deleteReason? }`) |
| `POST` | `/api/mgmt/suggestions/restore` | Restore a soft-deleted candidate (body: `{ campaignId, questionId, suggestionId }`) |
| `DELETE` | `/api/mgmt/campaigns/{campaignId}/votes` | Reset all votes for a campaign |
| `DELETE` | `/api/mgmt/campaigns/{campaignId}/suggestions` | Soft-delete all candidates + reset votes |
| `POST` | `/api/mgmt/campaigns/{campaignId}/reset` | Full reset (votes + soft-delete candidates) |

### Error responses

| Code | Meaning |
|---|---|
| `401` | Missing or incorrect admin secret |
| `404` | Campaign or suggestion not found |
| `409` | Conflict (e.g. candidate already deleted, or no vote to revoke) |
| `501` | `ADMIN_SECRET` not configured on the server |
