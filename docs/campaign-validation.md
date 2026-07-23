# Campaign Validation Rules

This document describes all validation rules applied when a campaign is created or updated.

Validation is implemented in:
- **Backend:** `api/src/campaignValidation.ts` — called by campaign create/update endpoints; returns HTTP 422 with `{ errors: string[] }` on failure.
- **Frontend:** `src/utils/validateCampaignRules.ts` — called in the admin UI before submitting; surfaces errors inline.

---

## Field reference

| Field | Type | Meaning | `0` means |
|---|---|---|---|
| `maxVotesTotal` | integer ≥ 0 | Maximum votes a user may cast across the entire campaign | Unlimited |
| `maxVotesPerCategory` | integer ≥ 0 | Maximum votes a user may cast within a single question/category | Unlimited |
| `maxVotesPerCandidate` | integer ≥ 0 | Maximum votes a user may cast for a single candidate | Unlimited |

> **Note:** The codebase uses `maxVotesPerCategory` (a number) rather than a boolean `allowMultipleVotesPerCategory`. Setting `maxVotesPerCategory = 1` is equivalent to `allowMultipleVotesPerCategory = false`.

---

## Validation rules

### V1 – Non-negative integers

All three vote-limit fields must be integers ≥ 0.

**Rationale:** Negative or fractional limits are logically impossible.

**Rejected examples:**
- `maxVotesTotal = -1`
- `maxVotesPerCategory = 1.5`

---

### V2 – Category limit ≤ total limit

If both `maxVotesPerCategory > 0` and `maxVotesTotal > 0`:

```
maxVotesPerCategory ≤ maxVotesTotal
```

**Rationale:** A voter cannot spend more votes in a single category than their total budget allows. This constraint is only active when both values are set (non-zero); if either is 0 (unlimited), the check is skipped.

**Rejected example:** `maxVotesTotal = 2, maxVotesPerCategory = 5`

---

### V3 – Candidate limit ≤ total limit

If both `maxVotesPerCandidate > 0` and `maxVotesTotal > 0`:

```
maxVotesPerCandidate ≤ maxVotesTotal
```

**Rationale:** A voter cannot cast more votes for one candidate than their total budget allows.

**Rejected example:** `maxVotesTotal = 3, maxVotesPerCandidate = 4`

---

### V4 – Candidate limit ≤ category limit

If both `maxVotesPerCandidate > 0` and `maxVotesPerCategory > 0`:

```
maxVotesPerCandidate ≤ maxVotesPerCategory
```

**Rationale:** A candidate belongs to exactly one category. A voter cannot cast more votes for a single candidate than the category allows in total.

**Rejected example:** `maxVotesPerCategory = 2, maxVotesPerCandidate = 5`

---

### V5 – Single-category-vote implies single-candidate-vote

If `maxVotesPerCategory = 1`:

```
maxVotesPerCandidate must be ≤ 1
```

**Rationale:** This is a specific, high-priority instance of V4 that produces a targeted error message for the most common misconfiguration. When only one vote is allowed per category, no more than one vote can be cast per candidate within that category.

**Rejected example:** `maxVotesPerCategory = 1, maxVotesPerCandidate = 4`

---

### V6 – Single total vote implies single per-scope votes

If `maxVotesTotal = 1`:

```
maxVotesPerCategory ≤ 1
maxVotesPerCandidate ≤ 1
```

**Rationale:** When only one vote is available in total, no individual scope (category or candidate) can receive more than one.

**Rejected example:** `maxVotesTotal = 1, maxVotesPerCategory = 2`

---

### V7 – Title must not be empty

```
title.trim() !== ''
```

**Rationale:** A campaign without a title cannot be identified by admins or users.

---

### V8 – Status must be a known value

```
status ∈ { 'draft', 'active', 'closed' }
```

**Rationale:** Prevents invalid state strings that would break filtering queries.

**Status transition guidance:**
- `draft → active`: Starts the campaign; voters can participate.
- `active → closed`: Ends the campaign; no new votes are accepted.
- `closed → active`: Re-opens the campaign.
- `draft → closed`: Skip active phase (e.g. cancelled before launch).
- `active → draft`: Not recommended (campaign was already visible to users).

---

## Interaction matrix

The three vote limits interact pairwise. All constraints are active only when **both** compared values are > 0.

|  | `maxVotesPerCandidate` | `maxVotesPerCategory` | `maxVotesTotal` |
|---|---|---|---|
| `maxVotesPerCandidate` | — | must be ≤ `maxVotesPerCategory` (V4/V5) | must be ≤ `maxVotesTotal` (V3) |
| `maxVotesPerCategory` | must be ≥ `maxVotesPerCandidate` (V4/V5) | — | must be ≤ `maxVotesTotal` (V2) |
| `maxVotesTotal` | must be ≥ `maxVotesPerCandidate` (V3) | must be ≥ `maxVotesPerCategory` (V2) | — |

---

## Valid configurations

| `maxVotesTotal` | `maxVotesPerCategory` | `maxVotesPerCandidate` | Notes |
|---|---|---|---|
| `4` | `1` | `1` | Canonical ninja-naming: one vote per category, four categories |
| `0` | `0` | `0` | Fully unlimited; all rules skipped |
| `10` | `3` | `2` | Multi-vote: 2 ≤ 3 (V4) ✓, 3 ≤ 10 (V2) ✓, 2 ≤ 10 (V3) ✓ |
| `0` | `2` | `1` | Unlimited total; 1 ≤ 2 (V4) ✓ |
| `1` | `1` | `1` | Single-vote campaign |

---

## Invalid configurations

| `maxVotesTotal` | `maxVotesPerCategory` | `maxVotesPerCandidate` | Violated rules |
|---|---|---|---|
| `3` | `1` | `4` | V5 (4 > 1), V3 (4 > 3) |
| `2` | `5` | `1` | V2 (5 > 2) |
| `0` | `0` | `-1` | V1 (negative) |
| `1` | `1` | `2` | V3 (2 > 1), V5 (maxVotesPerCategory = 1 and candidate = 2 > 1), V6 |
| `3` | `4` | `1` | V2 (4 > 3) |

---

## Unreachable configurations

Configurations where `maxVotesTotal` is higher than the theoretical maximum achievable votes (e.g. `maxVotesTotal = 100` with only 1 question, 1 candidate, and `maxVotesPerCandidate = 1`) are **not rejected** by this validator.

The total budget serves as an upper bound, not a required fill-count. Having a generous total limit that can never be fully spent is harmless and explicitly allowed.

---

## Behaviour when rules change after votes exist

Changing vote limits after votes have been cast does **not** retroactively invalidate existing votes. New limits apply only to future votes:
- **Tightened limits:** Users who already voted above the new limit cannot cast more votes; existing votes are preserved.
- **Relaxed limits:** Users may cast additional votes up to the new limit.

The API does not enforce that changing limits is safe relative to existing vote data. Administrators should consider the impact before modifying active campaigns.
