/**
 * Campaign configuration validation — frontend mirror of api/src/campaignValidation.ts.
 *
 * See api/src/campaignValidation.ts for the full rule documentation.
 * Returns an array of human-readable error strings. Empty = valid.
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

export function validateCampaignRules(config: CampaignRuleInput): string[] {
  const errors: string[] = []
  const { title, status, maxVotesTotal, maxVotesPerCategory, maxVotesPerCandidate } = config

  if (title !== undefined && title.trim() === '') {
    errors.push('Campaign title must not be empty.')
  }

  if (status !== undefined && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    errors.push(`Campaign status must be one of: ${VALID_STATUSES.join(', ')}.`)
  }

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
  if (intErrors.length > 0) {
    return [...errors, ...intErrors]
  }

  if (maxVotesPerCategory === 1 && maxVotesPerCandidate > 1) {
    errors.push(
      `When maxVotesPerCategory is 1 (one vote per category), maxVotesPerCandidate cannot exceed 1. ` +
        `Received maxVotesPerCandidate = ${maxVotesPerCandidate}.`,
    )
  } else if (maxVotesPerCandidate > 0 && maxVotesPerCategory > 0 && maxVotesPerCandidate > maxVotesPerCategory) {
    errors.push(
      `maxVotesPerCandidate (${maxVotesPerCandidate}) cannot exceed maxVotesPerCategory (${maxVotesPerCategory}). A candidate belongs to one category; you cannot vote for it more times than the category allows.`,
    )
  }

  if (maxVotesTotal === 1) {
    if (maxVotesPerCategory > 1) {
      errors.push(`When maxVotesTotal is 1, maxVotesPerCategory cannot exceed 1 (received ${maxVotesPerCategory}).`)
    }
    if (maxVotesPerCandidate > 1) {
      errors.push(`When maxVotesTotal is 1, maxVotesPerCandidate cannot exceed 1 (received ${maxVotesPerCandidate}).`)
    }
  }

  if (maxVotesPerCategory > 0 && maxVotesTotal > 0 && maxVotesPerCategory > maxVotesTotal) {
    errors.push(`maxVotesPerCategory (${maxVotesPerCategory}) cannot exceed maxVotesTotal (${maxVotesTotal}).`)
  }

  if (maxVotesPerCandidate > 0 && maxVotesTotal > 0 && maxVotesPerCandidate > maxVotesTotal) {
    errors.push(`maxVotesPerCandidate (${maxVotesPerCandidate}) cannot exceed maxVotesTotal (${maxVotesTotal}).`)
  }

  return errors
}
