# Admin Manual Test Plan

> Test all admin improvements introduced in this iteration against a live deployment (or local
> Azure Functions + Azurite emulator). No automated tests are defined here — this is a
> step-by-step human verification checklist.

---

## Prerequisites

- `ADMIN_SECRET` configured in `local.settings.json` (e.g. `secret123`)
- At least one campaign seeded (e.g. `ninja-naming`)
- At least three active candidates in the campaign
- Browser developer tools open to monitor network requests

---

## Part 1 — Authentication state

### T1-1 Successful login

1. Navigate to `/admin`.
2. Enter the correct admin secret and `ninja-naming` as Campaign ID.
3. Click **Load campaign**.

**Expected:**
- Green "Admin access granted" banner appears.
- Banner shows the campaign title and campaign ID in parentheses.
- The login form disappears.
- Campaign summary panel, action cards, and candidate tables are visible.
- No error message is shown.

### T1-2 Logout

1. Complete T1-1.
2. Click the **Logout** button in the green banner.

**Expected:**
- Green banner disappears.
- Login form re-appears with the secret field cleared.
- All campaign data (candidates, deleted candidates) is removed from the view.
- No network requests are made during logout.

### T1-3 Wrong admin secret

1. Enter an incorrect secret and a valid Campaign ID.
2. Click **Load campaign**.

**Expected:**
- Error banner: "Invalid admin secret. Please check your credentials and try again."
- Login form remains visible.
- No campaign data is loaded.

### T1-4 Admin secret not configured on server

1. Remove `ADMIN_SECRET` from `local.settings.json` and restart the Functions host.
2. Enter any secret and a valid Campaign ID.
3. Click **Load campaign**.

**Expected:**
- Error banner: "Admin access is not configured on this server. Contact your administrator."

### T1-5 Campaign not found

1. Enter the correct secret and a Campaign ID that does not exist (e.g. `does-not-exist`).
2. Click **Load campaign**.

**Expected:**
- Error banner: "Campaign not found. Please check the Campaign ID and try again."
- Login form remains visible.

### T1-6 Network unavailable

1. Open DevTools → Network → select **Offline**.
2. Enter correct credentials and click **Load campaign**.

**Expected:**
- Error banner: "API unavailable. Please check your connection and try again."

### T1-7 Enter key submits the form

1. Type the correct secret in the password field and press **Enter**.

**Expected:**
- Load campaign is triggered (same as clicking the button).

---

## Part 2 — Campaign summary panel

### T2-1 Summary shows correct counts

1. Log in with a campaign that has 3 active candidates and 1 deleted candidate, with a known
   total vote count.

**Expected:**
- Status pill shows the campaign status (e.g. "active").
- Active candidates: 3.
- Deleted candidates: 1 (card has red/warning styling).
- Total votes cast: matches the sum of all votes across both active and deleted candidates.

### T2-2 Zero deleted candidates

1. Log in with a campaign that has no deleted candidates.

**Expected:**
- Deleted candidates card shows "0" with no warning styling (normal card style).

### T2-3 Last modified shown when available

1. Log in with a campaign that has an `updatedAt` field set.

**Expected:**
- "Last modified" card shows a formatted date.

---

## Part 3 — Safety improvements

### T3-1 Full reset requires campaign ID

1. Log in and click **Full reset**.
2. Observe the confirmation dialog.

**Expected:**
- Dialog title: "⚠️ Full campaign reset".
- Dialog message lists what is affected and what is preserved.
- A text input is shown with the instruction "Type `ninja-naming` to confirm:".
- The **Full reset** confirm button is disabled.

3. Type a wrong campaign ID (e.g. `wrong-id`).

**Expected:**
- Confirm button remains disabled.

4. Type the correct campaign ID (`ninja-naming`).

**Expected:**
- Confirm button becomes active (red background).

5. Click **Cancel**.

**Expected:**
- Dialog closes. Confirmation input is cleared. No data is changed.

### T3-2 Full reset executes after correct campaign ID

1. Log in and click **Full reset**.
2. Type the correct campaign ID and click **Full reset**.

**Expected:**
- Dialog closes.
- Success banner: "Full reset complete for \<title\>. All votes deleted and all candidates soft-deleted. Campaign settings are preserved."
- Active candidates count drops to 0.
- Deleted candidates count increases by the number that were previously active.
- Total votes: 0.

### T3-3 Reset suggestions dialog shows count and impact

1. Click **Reset candidates**.

**Expected:**
- Dialog title: "Reset all candidates".
- Message includes the count of active candidates ("All N active candidates…").
- Message states what is affected (candidates soft-deleted, votes removed).
- Message states what is preserved (candidates restorable individually, settings unchanged).
- Message warns votes cannot be recovered.
- No text confirmation input required (confirm button active immediately).

---

## Part 4 — Deleted candidate visibility

### T4-1 All fields shown for deleted candidates

1. Delete a candidate with "Deleted by: tester" and "Reason: test reason" filled in.
2. Observe the Deleted candidates table.

**Expected:**
- Row shows: category, candidate name, vote count, deletion date + time (not just date), "tester",
  "test reason".

### T4-2 Missing metadata shows dash

1. Delete a candidate without filling in "Deleted by" or "Reason".

**Expected:**
- Deleted by and Reason columns show "—" for that candidate.

---

## Part 5 — Operational clarity

### T5-1 Action cards show Affects and Preserved labels

1. Log in and observe the Campaign actions section.

**Expected:**
- "Reset votes" card shows red "Affects:" label and green "Preserved:" label.
- "Reset candidates" card shows both labels with active candidate count.
- "Full reset" card has a red-tinted background and red border.
- "Full reset" strong title is red.

### T5-2 Restore button is green

1. Delete at least one candidate.
2. Observe the Deleted candidates table.

**Expected:**
- Restore button is green (not the default purple, not red).

### T5-3 Delete button is red-outline

1. Observe the Active candidates table.

**Expected:**
- Delete button has a red outline (danger variant) not a solid red background.

### T5-4 Restore confirmation dialog uses green button

1. Click **Restore** on a deleted candidate.

**Expected:**
- Confirmation dialog appears with a **green** confirm button labeled "Restore candidate".
- No text input required.

### T5-5 Delete confirmation shows vote count and restoration note

1. Click **Delete** on an active candidate with votes.

**Expected:**
- Dialog message mentions the candidate name, category, current vote count, and states votes are
  preserved and the candidate can be restored.

---

## Part 6 — Success feedback

### T6-1 Delete success

**Expected:** "\"<name>\" has been deleted. Existing votes are preserved and the candidate can be restored."

### T6-2 Restore success

**Expected:** "\"<name>\" has been restored and is now visible to voters with N vote(s)."

### T6-3 Reset votes success

**Expected:** "All votes for \"<title>\" have been reset to zero. All candidates are preserved."

### T6-4 Reset candidates success

**Expected:** "All N active candidates have been soft-deleted and all votes removed. Candidates can be restored individually."

### T6-5 Full reset success

**Expected:** "Full reset complete for \"<title>\". All votes deleted and all candidates soft-deleted. Campaign settings are preserved."

### T6-6 Success banner dismiss

1. Perform any successful operation.
2. Click the × button on the success banner before the 6-second auto-dismiss.

**Expected:**
- Banner disappears immediately.

---

## Part 7 — Error feedback

### T7-1 Error banner dismiss

1. Trigger any error (e.g. wrong admin secret).
2. Click the × button on the error banner.

**Expected:**
- Error banner disappears immediately.

### T7-2 Performing an operation while unauthenticated (state corruption guard)

This scenario should not be reachable via the normal UI because action buttons are hidden when
not authenticated. Confirm:

1. Log in normally.
2. In DevTools → Application → clear session storage (does not affect React state).
3. Perform a Delete operation.

**Expected:**
- Operation succeeds normally (state is in React memory, not storage).

---

## Regression checks (preserve existing behaviour)

### R1 — Voting still works after admin session

1. Log in to admin, delete a candidate, then restore it.
2. Navigate to `/c/ninja-naming` in another tab.

**Expected:**
- Restored candidate appears in the suggestion board.
- Voting on it works normally.

### R2 — Campaign routing unchanged

1. Navigate to `/c/ninja-naming` and `/c/best-padeller-2026`.

**Expected:**
- Both campaigns load correctly. No admin-related regressions.
