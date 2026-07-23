# Admin Production Readiness Review

> **Scope:** This document identifies remaining technical debt, security concerns, maintainability
> concerns, and usability concerns in the admin implementation. These are recommendations only —
> no new architecture is introduced.

---

## Technical debt

### 1. No pagination for large candidate lists

`GET /api/mgmt/suggestions` and `GET /api/suggestions` enumerate all rows in Azure Table Storage
for a campaign. For campaigns with hundreds of candidates, this can be slow and results in large
payloads. Azure Table Storage supports server-side continuation tokens but these are not
implemented.

**Recommendation:** Add a `top` + continuation-token query parameter pair to the list endpoints
when candidate counts are expected to exceed ~200.

### 2. No optimistic locking on concurrent admin operations

Two admins performing simultaneous operations (e.g. both deleting the same candidate) can
produce confusing 409 or 404 errors. These are handled gracefully by the UI today, but there is
no `ETag`-based concurrency control.

**Recommendation:** Use `If-Match: *` (unconditional) or `If-Match: "<etag>"` (conditional) on
`updateEntity` calls in `admin.ts` for deterministic conflict detection. Azure Table Storage
supports ETags on all entities.

### 3. `doResetVotes` and `doSoftDeleteAllSuggestions` are not transactional

If a reset operation is interrupted mid-way (e.g. a Function timeout), the campaign is left in a
partially reset state (some votes deleted, some remaining). Azure Table Storage does not support
cross-partition transactions.

**Recommendation:** Either (a) add a "reset in progress" flag to the campaign row so the UI can
detect and report incomplete resets, or (b) document this known limitation in the admin guide and
instruct admins to re-run the reset if interrupted.

### 4. No audit log

Soft-deletion stores `deletedBy` / `deleteReason` but there is no log of vote resets or full
resets. There is no way to query "who reset campaign X at time T".

**Recommendation:** Add a lightweight `auditLog` table in Azure Table Storage (one row per admin
operation). Entra ID migration (see `admin-entra-migration.md`) would make this significantly more
useful.

---

## Security concerns

### 1. Shared admin secret — no individual accountability

The current `ADMIN_SECRET` is shared across all admins. If the secret is compromised, all admin
access must be revoked by rotating the secret. There is no way to revoke access for one individual.

**Recommendation:** Migrate to Entra ID app roles (see `admin-entra-migration.md`). Until then,
rotate `ADMIN_SECRET` immediately when any admin leaves the team.

### 2. No rate limiting on admin endpoints

All `/api/mgmt/*` routes accept requests at unlimited rate. A leaked or brute-forced secret can be
used to repeatedly trigger destructive operations. Azure Functions does not apply rate limiting
by default.

**Recommendation:** Enable Azure API Management (APIM) in front of the Functions app, or use Azure
Static Web Apps rate limiting rules, to throttle requests to admin endpoints.

### 3. Admin secret entered in a browser form

Although the secret is not persisted to `localStorage`, it is visible in React DevTools component
state and in browser memory profiles. On shared/public machines, this is a risk.

**Recommendation:** Advise admins to use private/incognito browsing sessions. The Logout button
clears state but cannot guarantee memory is wiped. Entra ID SSO eliminates this concern entirely.

### 4. No CSRF protection on admin mutations

Admin routes accept requests from any origin as long as the `X-Admin-Secret` header is present.
Browsers do not send custom headers on cross-origin simple requests, so CSRF is mitigated in
practice, but this is not explicitly enforced.

**Recommendation:** Add a `CORS` origin allowlist to the Azure Static Web Apps configuration to
restrict API calls to the known app origin.

---

## Maintainability concerns

### 1. `AdminPage.tsx` is a single large component (~370 lines)

All state, event handlers, and rendering are co-located in one file. This is acceptable at the
current feature size but will become hard to maintain as more admin features are added.

**Recommendation:** Extract into sub-components when adding the next significant admin feature:
- `<AdminAuthSection>` — login form + auth status bar
- `<CampaignSummaryPanel>` — stats cards
- `<AdminActionPanel>` — destructive action cards
- `<CandidateTable>` / `<DeletedCandidateTable>` — table components
- `<ConfirmDialog>` — shared dialog

### 2. Error message mapping is duplicated between admin and (future) other pages

`getAdminErrorMessage()` in `AdminPage.tsx` maps API error strings manually. If the API changes
its error messages, all mappings must be updated in sync.

**Recommendation:** When introducing other admin-facing pages, move error mapping to `src/api.ts`
using a typed `ApiError` class that carries the HTTP status code, so callers can switch on status
rather than message strings.

### 3. No unit tests for admin UI

The `AdminPage` component has no test coverage. Regressions in confirmation dialogs, typed-input
confirmation, or error-message mapping would not be caught automatically.

**Recommendation:** Add Vitest + Testing Library tests covering:
- Auth flow: load campaign with correct / wrong secret
- Confirmation dialog: full reset requires campaign ID; confirm button disabled until match
- Success/error banner: dismiss button removes the banner
- Restore dialog: uses green button (not destructive)

---

## Usability concerns

### 1. No bulk restore

After a reset, admins must restore candidates one by one. For campaigns with many deleted
candidates, this is tedious.

**Recommendation:** Add a "Restore all" button in the Deleted candidates section.

### 2. No campaign creation or editing via the admin panel

Campaigns and questions must be seeded directly into Azure Table Storage (via the seed script or
Azure Storage Explorer). The admin panel is management-only.

**Recommendation:** Add a read-only campaign settings view to the admin panel first. Full
campaign editing (status, vote limits) can be added later via a PATCH endpoint.

### 3. No loading indicator during post-action refresh

After a delete/restore/reset, the UI calls `refresh()` which silently re-fetches candidates.
If the refresh is slow, the table appears stale with no indication that a reload is in progress.

**Recommendation:** Add a `refreshing` boolean state and show a subtle spinner or "Refreshing…"
indicator in the candidate table headers during post-action refresh.

### 4. Deleted candidates section is always visible (even when empty)

An empty "Deleted candidates (0)" section with descriptive text takes up space when there is
nothing to show.

**Recommendation:** Collapse the section body (show only the heading) when there are no deleted
candidates, similar to how other sections handle the zero-state with `admin-empty`.

### 5. Campaign ID is hardcoded to `ninja-naming`

The Campaign ID input defaults to `ninja-naming`. On non-ninja-naming deployments, admins must
remember to change this, or they get a confusing "Campaign not found" error.

**Recommendation:** Default the Campaign ID field to an empty string (or derive it from the
current route if the admin panel is accessed from a campaign page).
