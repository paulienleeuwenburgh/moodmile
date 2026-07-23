# Admin Improvements Summary

> This document summarises the admin improvements implemented in this iteration.

---

## Overview

This iteration focused exclusively on admin functionality across six areas:
usability, campaign visibility, safety, deleted-candidate clarity, operational labelling,
and future-proofing documentation.

Working polling functionality (routing, suggestions, voting, persistence) was not modified.

---

## Part 1 — Admin usability

### A. Authentication state

- After a successful "Load campaign", a green **"Admin access granted"** banner appears showing the campaign title and campaign ID.
- A **Logout** button in the banner clears the admin secret and all campaign data from memory and returns the UI to the login form.
- The login form is hidden while authenticated; the auth bar replaces it.

### B. Success feedback

Each operation now shows a specific success message:

| Operation | Message |
|---|---|
| Delete candidate | `"<name>" has been deleted. Existing votes are preserved and the candidate can be restored.` |
| Restore candidate | `"<name>" has been restored and is now visible to voters with N vote(s).` |
| Reset votes | `All votes for "<title>" have been reset to zero. All candidates are preserved.` |
| Reset candidates | `All N active candidates have been soft-deleted and all votes removed. Candidates can be restored individually.` |
| Full reset | `Full reset complete for "<title>". All votes deleted and all candidates soft-deleted. Campaign settings are preserved.` |

Success banners are dismissable and auto-clear after 6 seconds.

### C. Error feedback

API errors are mapped to specific human-readable messages:

| Situation | Message |
|---|---|
| Wrong admin secret (401) | "Invalid admin secret. Please check your credentials and try again." |
| Secret not configured (501) | "Admin access is not configured on this server. Contact your administrator." |
| Campaign not found (404) | "Campaign not found. Please check the Campaign ID and try again." |
| Server error (5xx) | "Unexpected server error. Please try again later." |
| Network failure | "API unavailable. Please check your connection and try again." |
| Other API errors | Server's error message shown directly |

Error banners are dismissable and appear outside the auth-gated section so they are always visible.

---

## Part 2 — Campaign summary panel

A summary panel is shown at the top of the authenticated admin view, displaying:

- **Status** — current campaign status as a styled pill
- **Active candidates** — count of non-deleted candidates
- **Deleted candidates** — count of soft-deleted candidates (warning styling when > 0)
- **Total votes cast** — sum across all active and deleted candidates
- **Last modified** — formatted `updatedAt` date (if set in the campaign row)

This gives admins a full picture of campaign state before taking any action.

---

## Part 3 — Safety improvements

### A. Reset candidates confirmation

The Reset candidates dialog now explicitly states:
- The count of candidates that will be affected
- That candidates are soft-deleted (restorable individually)
- That votes cannot be recovered

### B. Full campaign reset — typed confirmation

The Full reset dialog now requires the admin to type the exact campaign ID before the confirm
button becomes active. The confirm button remains disabled until the input matches exactly.
This prevents accidental data loss.

---

## Part 4 — Deleted candidate visibility

The Deleted candidates table already showed all required fields. This iteration improved:

- **Deleted at** column: now shows full date and time (`toLocaleString()`) instead of date-only
- Existing fields preserved: category, candidate name, votes, deleted by, reason

---

## Part 5 — Operational clarity

### Affects / Preserved labels

Every action card in the Campaign actions section now shows:
- **Affects:** (in red) — what data will be changed or deleted
- **Preserved:** (in green) — what data remains intact

### Visual hierarchy by risk level

| Risk | Visual | Examples |
|---|---|---|
| Safe | Green button (`admin-btn--restore`) | Restore candidate |
| Medium | Red-outline button (`admin-btn--danger`) | Delete, Reset votes, Reset candidates |
| Highest | Red-filled card + red button (`admin-action--destructive`) | Full reset |

### Restore confirmation dialog

The restore confirmation dialog uses a **green** confirm button (not red/destructive), visually
signalling that restore is a safe, reversible action.

---

## Part 6 — Entra ID migration notes

See [`docs/admin-entra-migration.md`](./admin-entra-migration.md) for:

- Which files change: `admin.ts`, `api.ts`, `AdminPage.tsx`, `staticwebapp.config.json`
- Which parts remain reusable: all business logic, all UI (except auth section)
- Estimated effort: ~3–4 days
- Benefits: no shared secret, per-user audit trail, MFA, SSO

---

## Part 7 — Production readiness review

See [`docs/admin-production-review.md`](./admin-production-review.md) for:

- **Technical debt:** no pagination, no optimistic locking, non-transactional resets, no audit log
- **Security:** shared secret (no individual accountability), no rate limiting, no CSRF allowlist
- **Maintainability:** single large component, no unit tests for admin UI
- **Usability:** no bulk restore, no campaign editing, no refresh indicator

---

## Files changed

| File | Type | Description |
|---|---|---|
| `src/pages/AdminPage.tsx` | Modified | All usability, safety, clarity improvements |
| `src/App.css` | Modified | New CSS classes for auth bar, summary panel, feedback banners, restore button |
| `docs/admin-guide.md` | Modified | Reflects new panel behaviour, error messages, and visual hierarchy |
| `docs/admin-entra-migration.md` | New | Entra ID migration notes (Part 6) |
| `docs/admin-production-review.md` | New | Production readiness review (Part 7) |
| `docs/admin-test-plan.md` | New | Manual test plan for all admin improvements |
| `docs/admin-improvements.md` | New | This document |
