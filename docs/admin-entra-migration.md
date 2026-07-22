# Admin Entra ID Migration Notes

> **Scope:** This document describes what a migration from the current shared-secret admin model to
> Microsoft Entra ID (formerly Azure AD) would involve. **No Entra ID code is implemented.**
> The purpose is to allow future developers to plan the migration without re-reading all source files.

---

## Current authentication model

Authentication is implemented as a shared API key in one place on the backend and one place on the
frontend.

**Backend (`api/src/functions/admin.ts` — `requireAdminSecret()`):**

```typescript
function requireAdminSecret(request: HttpRequest): HttpResponseInit | null {
  const configured = process.env.ADMIN_SECRET
  if (!configured) {
    return { status: 501, jsonBody: { error: 'Admin functionality is not configured on this server.' } }
  }
  const provided = request.headers.get('x-admin-secret')
  if (!provided || provided !== configured) {
    return { status: 401, jsonBody: { error: 'Unauthorized' } }
  }
  return null
}
```

Every admin handler calls `requireAdminSecret(request)` as its first line.

**Frontend (`src/api.ts` — `adminHeaders()`):**

```typescript
function adminHeaders(adminSecret: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret }
}
```

All admin API calls pass this header.

**Frontend (`src/pages/AdminPage.tsx`):**

The admin secret is stored in React component state (`useState('')`), entered once in a password
field. Logout clears the state. The secret is never written to `localStorage` or cookies.

---

## Files that change during an Entra ID migration

| File | Change required |
|---|---|
| `api/src/functions/admin.ts` | Replace `requireAdminSecret()` with token validation using `@azure/identity` or the Azure Functions built-in `EasyAuth` token validation |
| `src/api.ts` — `adminHeaders()` | Replace `X-Admin-Secret` header with `Authorization: ****** |
| `src/pages/AdminPage.tsx` | Replace the secret text input and `useState('')` secret state with an MSAL authentication flow (sign-in button, `useMsal()` hook, token acquisition via `acquireTokenSilent`) |
| `src/main.tsx` or a new `AuthProvider` wrapper | Wrap the router with `MsalProvider` from `@azure/msal-react` |
| `staticwebapp.config.json` | Add `auth` section to configure the Azure Static Web Apps EasyAuth provider (or configure `linkedBackend` for token pass-through) |
| Azure portal / Entra app registration | Create app registration, define `Admin` app role, assign users |

### Backend option: Azure Static Web Apps EasyAuth (simplest)

Azure Static Web Apps supports built-in authentication. When EasyAuth is configured, the Functions
runtime receives a validated `x-ms-client-principal` header. Token validation moves entirely to the
platform:

```typescript
// Replace requireAdminSecret() with:
function requireAdminRole(request: HttpRequest): HttpResponseInit | null {
  const principal = request.headers.get('x-ms-client-principal')
  if (!principal) {
    return { status: 401, jsonBody: { error: 'Authentication required.' } }
  }
  const decoded = JSON.parse(Buffer.from(principal, 'base64').toString('utf8'))
  const hasAdminRole = decoded.userRoles?.includes('Admin') ?? false
  if (!hasAdminRole) {
    return { status: 403, jsonBody: { error: 'Forbidden — Admin role required.' } }
  }
  return null
}
```

### Backend option: manual token validation (more control)

Use `@azure/identity` or `jsonwebtoken` + JWKS to validate the ****** and check app roles
directly in the function. This is necessary when the Functions app is deployed standalone (not as
part of a Static Web App).

---

## Parts of the current admin implementation that remain reusable

All business logic is independent of authentication and requires no changes:

- `doResetVotes(campaignId)` — reset all votes for a campaign
- `doSoftDeleteAllSuggestions(campaignId)` — soft-delete all candidates
- `processBatches(items, fn)` — parallel batch processor
- All individual admin handlers (`deleteSuggestion`, `restoreSuggestion`, `resetCampaignVotes`, `resetCampaignSuggestions`, `fullCampaignReset`, `getDeletedSuggestions`) — just replace the `requireAdminSecret` call at the top of each with `requireAdminRole`
- All admin API functions in `src/api.ts` (`adminDeleteSuggestion`, `adminRestoreSuggestion`, etc.) — replace `adminHeaders()` to send a ******
- All admin UI components in `src/pages/AdminPage.tsx` — the campaign summary panel, action cards, confirmation dialogs, deleted-candidates table, and all handlers remain unchanged; only the auth section and logout behaviour change

---

## Expected migration effort

| Task | Effort |
|---|---|
| Entra app registration and role definition | 1–2 hours |
| Backend: replace `requireAdminSecret()` with EasyAuth role check | 1–2 hours |
| Frontend: add `MsalProvider`, replace password field with sign-in button | 1 day |
| Token acquisition and header injection in `src/api.ts` | 2–4 hours |
| `staticwebapp.config.json` auth section + role assignment | 1–2 hours |
| End-to-end testing | 1 day |
| **Total** | **~3–4 days** |

---

## Benefits of the migration

| Benefit | Detail |
|---|---|
| **No shared secret** | Eliminates risk of secret leakage in configuration stores, chat logs, or CI/CD pipelines |
| **Per-user audit trail** | Every admin action can be attributed to a named Entra user (`deletedBy` field can be populated automatically from token claims) |
| **Conditional Access** | Organisation can enforce MFA, device compliance, and IP restrictions on admin access without any code change |
| **No secret rotation** | Entra tokens expire automatically; no `ADMIN_SECRET` to rotate periodically |
| **Least privilege** | Access can be scoped to specific users or groups via Entra app roles |
| **Single sign-on** | Admins who are already signed in to Microsoft 365 do not need to enter a separate password |

---

## Non-goals of this migration

- Role-based access within the admin panel (e.g. read-only vs full access) — not needed at current scale; can be added later with additional app roles
- Replacing Azure Table Storage with a more scalable database — independent concern
