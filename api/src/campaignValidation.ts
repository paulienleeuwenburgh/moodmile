/**
 * Campaign configuration validation.
 *
 * This module enforces logical consistency rules on campaign voting configuration.
 * Validation is performed when a campaign is created or updated.
 *
 * ---
 * Validation rules
 * ---
 *
 * V1 – Non-negative integers
 *   maxVotesTotal, maxVotesPerCategory, maxVotesPerCandidate must each be an integer ≥ 0.
 *   Rationale: Negative or fractional limits are logically impossible.
 *
 * V2 – Category limit must not exceed total limit
 *   If maxVotesPerCategory > 0 and maxVotesTotal > 0:
 *     maxVotesPerCategory ≤ maxVotesTotal
 *   Rationale: Spending more votes in one category than the total budget allows is impossible.
 *
 * V3 – Candidate limit must not exceed total limit
 *   If maxVotesPerCandidate > 0 and maxVotesTotal > 0:
 *     maxVotesPerCandidate ≤ maxVotesTotal
 *   Rationale: Casting more votes for one candidate than the total budget allows is impossible.
 *
 * V4 – Candidate limit must not exceed category limit
 *   If maxVotesPerCandidate > 0 and maxVotesPerCategory > 0:
 *     maxVotesPerCandidate ≤ maxVotesPerCategory
 *   Rationale: A candidate belongs to exactly one category. You cannot vote for a candidate
 *   more times than the category allows in total.
 *
 * V5 – Single-vote-per-category implies single-vote-per-candidate
 *   If maxVotesPerCategory = 1:
 *     maxVotesPerCandidate must be ≤ 1
 *   Rationale: Specific, high-priority instance of V4 that produces a targeted error message
 *   for the most common misconfiguration.
 *   Note: In this codebase "allowMultipleVotesPerCategory = false" is equivalent to
 *   maxVotesPerCategory = 1.
 *
 * V6 – Single-vote-total implies all per-scope limits ≤ 1
 *   If maxVotesTotal = 1:
 *     maxVotesPerCategory and maxVotesPerCandidate must each be ≤ 1
 *   Rationale: When only one vote is available, no scope can exceed 1.
 *
 * V7 – Title must not be empty
 *   Rationale: A campaign without a title cannot be identified by admins or users.
 *
 * V8 – Status must be a known value
 *   Allowed: 'draft' | 'active' | 'closed'
 *   Rationale: Prevents invalid state strings that would break filtering queries.
 *
 * ---
 * Status transition rules
 * ---
 *   draft   → active   Allowed. Starts the campaign; voters can participate.
 *   active  → closed   Allowed. Ends the campaign; no new votes are accepted.
 *   closed  → active   Allowed (re-open). Use with care if votes already exist.
 *   draft   → closed   Allowed (skip active phase, e.g. cancelled before launch).
 *   active  → draft    Not recommended. The campaign was already visible; going back to
 *                      draft is confusing to participants. Not enforced here, but should be
 *                      avoided operationally.
 *
 * ---
 * Behaviour when campaign rules change after votes exist
 * ---
 *   Changing vote limits after votes have been cast does NOT retroactively invalidate
 *   existing votes. The new limits apply only to future votes. If limits are tightened,
 *   users who already voted above the new limit simply cannot cast more votes; their
 *   existing votes are preserved. If limits are relaxed, users may cast additional votes
 *   up to the new limit.
 *
 * ---
 * Unreachable configurations
 * ---
 *   Configurations where maxVotesTotal is higher than the theoretical maximum achievable
 *   votes (e.g. maxVotesTotal = 100 but there is only 1 question with 1 candidate and
 *   maxVotesPerCandidate = 1) are NOT rejected by this validator. The total budget serves
 *   as an upper bound, not a required fill-count. Having a generous total limit that can
 *   never be fully spent is harmless and is explicitly allowed.
 *
 * ---
 * Valid configuration examples
 * ---
 *   { maxVotesTotal: 4, maxVotesPerCategory: 1, maxVotesPerCandidate: 1 }
 *     One vote per category, four categories — the canonical ninja-naming setup.
 *   { maxVotesTotal: 0, maxVotesPerCategory: 0, maxVotesPerCandidate: 0 }
 *     Fully unlimited. All zero = no constraint.
 *   { maxVotesTotal: 10, maxVotesPerCategory: 3, maxVotesPerCandidate: 2 }
 *     2 ≤ 3 (V4) ✓, 3 ≤ 10 (V2) ✓, 2 ≤ 10 (V3) ✓
 *   { maxVotesTotal: 0, maxVotesPerCategory: 2, maxVotesPerCandidate: 1 }
 *     Total unlimited; 1 ≤ 2 (V4) ✓
 *   { maxVotesTotal: 1, maxVotesPerCategory: 1, maxVotesPerCandidate: 1 }
 *     Single-vote campaign.
 *
 * ---
 * Invalid configuration examples
 * ---
 *   { maxVotesTotal: 3, maxVotesPerCategory: 1, maxVotesPerCandidate: 4 }
 *     Violates V4 (4 > 1) and V3 (4 > 3).
 *   { maxVotesTotal: 2, maxVotesPerCategory: 5, maxVotesPerCandidate: 1 }
 *     Violates V2 (5 > 2).
 *   { maxVotesTotal: 0, maxVotesPerCategory: 0, maxVotesPerCandidate: -1 }
 *     Violates V1 (negative value).
 *   { maxVotesTotal: 1, maxVotesPerCategory: 1, maxVotesPerCandidate: 2 }
 *     Violates V3 (2 > 1), V4 (2 > 1), and V6.
 */

export interface CampaignRuleInput {
  title?: string
  status?: string
  maxVotesTotal: number
  maxVotesPerCategory: number
  maxVotesPerCandidate: number
}

const VALID_STATUSES = ['draft', 'active', 'closed'] as const

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

/**
 * Validate a campaign's voting-rule configuration.
 * Returns an array of human-readable error strings.
 * An empty array means the configuration is valid.
 */
export function validateCampaignRules(config: CampaignRuleInput): string[] {
  const errors: string[] = []

  const { title, status, maxVotesTotal, maxVotesPerCategory, maxVotesPerCandidate } = config

  // V7 – Title must not be empty
  if (title !== undefined && title.trim() === '') {
    errors.push('Campaign title must not be empty.')
  }

  // V8 – Status must be a known value
  if (status !== undefined && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    errors.push(`Campaign status must be one of: ${VALID_STATUSES.join(', ')}.`)
  }

  // V1 – All limits must be non-negative integers
  const intErrors: string[] = []
  if (!isNonNegativeInteger(maxVotesTotal)) {
    intErrors.push(`maxVotesTotal must be a non-negative integer (received ${maxVotesTotal}).`)
  }
  if (!isNonNegativeInteger(maxVotesPerCategory)) {
    intErrors.push(`maxVotesPerCategory must be a non-negative integer (received ${maxVotesPerCategory}).`)
  }
  if (!isNonNegativeInteger(maxVotesPerCandidate)) {
    intErrors.push(`maxVotesPerCandidate must be a non-negative integer (received ${maxVotesPerCandidate}).`)
  }

  // Stop relational checks if any integer values are invalid, to avoid misleading errors.
  if (intErrors.length > 0) {
    return [...errors, ...intErrors]
  }

  // V5 – Single-vote-per-category implies single-vote-per-candidate (specific case of V4)
  if (maxVotesPerCategory === 1 && maxVotesPerCandidate > 1) {
    errors.push(
      `When maxVotesPerCategory is 1 (one vote per category), maxVotesPerCandidate cannot exceed 1. ` +
        `Received maxVotesPerCandidate = ${maxVotesPerCandidate}.`,
    )
  }

  // V4 – Candidate limit must not exceed category limit
  else if (maxVotesPerCandidate > 0 && maxVotesPerCategory > 0 && maxVotesPerCandidate > maxVotesPerCategory) {
    errors.push(
      `maxVotesPerCandidate (${maxVotesPerCandidate}) cannot exceed maxVotesPerCategory (${maxVotesPerCategory}). A candidate belongs to one category; you cannot vote for it more times than the category allows.`,
    )
  }

  // V6 – Single-vote-total implies all per-scope limits ≤ 1
  if (maxVotesTotal === 1) {
    if (maxVotesPerCategory > 1) {
      errors.push(
        `When maxVotesTotal is 1, maxVotesPerCategory cannot exceed 1 (received ${maxVotesPerCategory}).`,
      )
    }
    if (maxVotesPerCandidate > 1) {
      errors.push(
        `When maxVotesTotal is 1, maxVotesPerCandidate cannot exceed 1 (received ${maxVotesPerCandidate}).`,
      )
    }
  }

  // V2 – Category limit must not exceed total limit
  if (maxVotesPerCategory > 0 && maxVotesTotal > 0 && maxVotesPerCategory > maxVotesTotal) {
    errors.push(
      `maxVotesPerCategory (${maxVotesPerCategory}) cannot exceed maxVotesTotal (${maxVotesTotal}).`,
    )
  }

  // V3 – Candidate limit must not exceed total limit
  if (maxVotesPerCandidate > 0 && maxVotesTotal > 0 && maxVotesPerCandidate > maxVotesTotal) {
    errors.push(
      `maxVotesPerCandidate (${maxVotesPerCandidate}) cannot exceed maxVotesTotal (${maxVotesTotal}).`,
    )
  }

  return errors
}
