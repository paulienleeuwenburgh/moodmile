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

Navigate to `/admin` in the app. Enter the admin secret in the password field, then enter a Campaign ID and click **Load campaign**.

> **Security note:** The secret is kept in browser memory only. It is never written to `localStorage`, cookies, or sent in GET requests. HTTPS is enforced by Azure Static Web Apps for all traffic.

---

## Admin actions

### Delete a candidate (soft delete)

- **Effect:** The candidate is hidden from the suggestion board and leaderboard. It no longer appears in voting.
- **Votes:** Existing votes for this candidate are **preserved** in storage. The vote count remains on the candidate row for audit purposes.
- **Vote budget:** Votes already cast for a deleted candidate **count against** the voter's remaining budget. This prevents users from gaining extra votes by having their preferred candidate deleted.
- **Metadata fields stored:**
  - `isDeleted`: `true`
  - `deletedAt`: ISO timestamp
  - `deletedBy`: admin identifier (optional, entered in the UI)
  - `deleteReason`: reason (optional, entered in the UI)
- **Reversible:** Yes — see *Restore a candidate* below.

### Restore a candidate

- **Effect:** The candidate reappears in the suggestion board, leaderboard, and voting immediately.
- **Votes:** The original vote count is restored intact.
- **Voting:** Users can vote for or revoke votes on the candidate again as normal.
- **Note:** Votes cast before deletion still count against users' budgets (they were never refunded), so a restored candidate may show existing votes from before it was deleted.

### Reset campaign votes

- **Effect:** All vote rows for the campaign are deleted. Every candidate's vote counter is reset to `0`.
- **Candidates:** Not affected — all active and soft-deleted candidates are preserved.
- **Reversible:** No.

### Reset campaign candidates

- **Effect:** All active (non-deleted) candidates are soft-deleted. All votes are also removed.
- **Vote history:** Soft-deleted candidates retain their rows in storage. Vote rows are deleted.
- **Reason for soft delete (not hard delete):** Keeping candidate rows means the suggestion IDs in historical vote rows remain resolvable. Hard-deleting candidates would leave orphaned vote row keys, making audit data unexplainable.
- **Reversible:** Candidates can be restored individually. Votes cannot be recovered.

### Full campaign reset

- **Effect:** Combines vote reset + candidate reset. All votes are deleted and all candidates are soft-deleted.
- **Campaign configuration:** Title, status, and voting rules are untouched.
- **Reversible:** Candidates can be restored individually. Votes cannot be recovered.

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

## API reference

All admin routes require the `X-Admin-Secret: <secret>` header.

| Method | Route | Action |
|---|---|---|
| `GET` | `/api/admin/suggestions?campaignId=X` | List soft-deleted candidates for a campaign |
| `DELETE` | `/api/admin/suggestions` | Soft-delete a candidate (body: `{ campaignId, questionId, suggestionId, deletedBy?, deleteReason? }`) |
| `POST` | `/api/admin/suggestions/restore` | Restore a soft-deleted candidate (body: `{ campaignId, questionId, suggestionId }`) |
| `DELETE` | `/api/admin/campaigns/{campaignId}/votes` | Reset all votes for a campaign |
| `DELETE` | `/api/admin/campaigns/{campaignId}/suggestions` | Soft-delete all candidates + reset votes |
| `POST` | `/api/admin/campaigns/{campaignId}/reset` | Full reset (votes + soft-delete candidates) |

### Error responses

| Code | Meaning |
|---|---|
| `401` | Missing or incorrect admin secret |
| `404` | Campaign or suggestion not found |
| `409` | Conflict (e.g. candidate already deleted, or no vote to revoke) |
| `501` | `ADMIN_SECRET` not configured on the server |
