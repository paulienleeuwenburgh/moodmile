import { describe, it, expect } from 'vitest'
import { validateCampaignRules } from './campaignValidation'

describe('validateCampaignRules', () => {
  // ── Valid configurations ──────────────────────────────────────────────────

  it('accepts the canonical ninja-naming configuration', () => {
    expect(
      validateCampaignRules({
        title: 'Ninja naming',
        status: 'active',
        maxVotesTotal: 4,
        maxVotesPerCategory: 1,
        maxVotesPerCandidate: 1,
      }),
    ).toEqual([])
  })

  it('accepts fully unlimited configuration (all zeros)', () => {
    expect(
      validateCampaignRules({
        title: 'Open poll',
        status: 'active',
        maxVotesTotal: 0,
        maxVotesPerCategory: 0,
        maxVotesPerCandidate: 0,
      }),
    ).toEqual([])
  })

  it('accepts a multi-vote configuration within bounds', () => {
    expect(
      validateCampaignRules({
        title: 'Multi-vote poll',
        status: 'active',
        maxVotesTotal: 10,
        maxVotesPerCategory: 3,
        maxVotesPerCandidate: 2,
      }),
    ).toEqual([])
  })

  it('accepts unlimited total with bounded per-category and per-candidate', () => {
    expect(
      validateCampaignRules({
        title: 'Poll',
        status: 'draft',
        maxVotesTotal: 0,
        maxVotesPerCategory: 2,
        maxVotesPerCandidate: 1,
      }),
    ).toEqual([])
  })

  it('accepts a single-vote campaign (all 1s)', () => {
    expect(
      validateCampaignRules({
        title: 'Single vote',
        status: 'closed',
        maxVotesTotal: 1,
        maxVotesPerCategory: 1,
        maxVotesPerCandidate: 1,
      }),
    ).toEqual([])
  })

  it('omitting title and status skips those checks', () => {
    expect(
      validateCampaignRules({
        maxVotesTotal: 4,
        maxVotesPerCategory: 1,
        maxVotesPerCandidate: 1,
      }),
    ).toEqual([])
  })

  it('accepts maxVotesPerCandidate equal to maxVotesPerCategory', () => {
    expect(
      validateCampaignRules({
        maxVotesTotal: 5,
        maxVotesPerCategory: 2,
        maxVotesPerCandidate: 2,
      }),
    ).toEqual([])
  })

  // ── V1 – Non-negative integers ────────────────────────────────────────────

  it('V1: rejects negative maxVotesTotal', () => {
    const errors = validateCampaignRules({
      maxVotesTotal: -1,
      maxVotesPerCategory: 0,
      maxVotesPerCandidate: 0,
    })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('maxVotesTotal')
    expect(errors[0]).toContain('-1')
  })

  it('V1: rejects negative maxVotesPerCategory', () => {
    const errors = validateCampaignRules({
      maxVotesTotal: 0,
      maxVotesPerCategory: -3,
      maxVotesPerCandidate: 0,
    })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('maxVotesPerCategory')
  })

  it('V1: rejects negative maxVotesPerCandidate', () => {
    const errors = validateCampaignRules({
      maxVotesTotal: 0,
      maxVotesPerCategory: 0,
      maxVotesPerCandidate: -2,
    })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('maxVotesPerCandidate')
  })

  it('V1: rejects fractional values', () => {
    const errors = validateCampaignRules({
      maxVotesTotal: 1.5,
      maxVotesPerCategory: 0,
      maxVotesPerCandidate: 0,
    })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('maxVotesTotal')
  })

  // ── V2 – Category ≤ total ─────────────────────────────────────────────────

  it('V2: rejects maxVotesPerCategory exceeding maxVotesTotal', () => {
    const errors = validateCampaignRules({
      maxVotesTotal: 2,
      maxVotesPerCategory: 5,
      maxVotesPerCandidate: 1,
    })
    expect(errors.some((e) => e.includes('maxVotesPerCategory') && e.includes('maxVotesTotal'))).toBe(true)
  })

  it('V2: skips check when maxVotesTotal is 0 (unlimited)', () => {
    expect(
      validateCampaignRules({
        maxVotesTotal: 0,
        maxVotesPerCategory: 99,
        maxVotesPerCandidate: 1,
      }),
    ).toEqual([])
  })

  it('V2: skips check when maxVotesPerCategory is 0 (unlimited)', () => {
    expect(
      validateCampaignRules({
        maxVotesTotal: 2,
        maxVotesPerCategory: 0,
        maxVotesPerCandidate: 1,
      }),
    ).toEqual([])
  })

  // ── V3 – Candidate ≤ total ────────────────────────────────────────────────

  it('V3: rejects maxVotesPerCandidate exceeding maxVotesTotal', () => {
    const errors = validateCampaignRules({
      maxVotesTotal: 3,
      maxVotesPerCategory: 1,
      maxVotesPerCandidate: 4,
    })
    expect(errors.some((e) => e.includes('maxVotesPerCandidate') && e.includes('maxVotesTotal'))).toBe(true)
  })

  it('V3: skips check when maxVotesTotal is 0 (unlimited)', () => {
    expect(
      validateCampaignRules({
        maxVotesTotal: 0,
        maxVotesPerCategory: 0,
        maxVotesPerCandidate: 50,
      }),
    ).toEqual([])
  })

  // ── V4 – Candidate ≤ category ─────────────────────────────────────────────

  it('V4: rejects maxVotesPerCandidate exceeding maxVotesPerCategory', () => {
    const errors = validateCampaignRules({
      maxVotesTotal: 10,
      maxVotesPerCategory: 2,
      maxVotesPerCandidate: 5,
    })
    expect(errors.some((e) => e.includes('maxVotesPerCandidate') && e.includes('maxVotesPerCategory'))).toBe(true)
  })

  it('V4: skips check when maxVotesPerCategory is 0 (unlimited)', () => {
    expect(
      validateCampaignRules({
        maxVotesTotal: 10,
        maxVotesPerCategory: 0,
        maxVotesPerCandidate: 8,
      }),
    ).toEqual([])
  })

  // ── V5 – Single-category implies single-candidate ─────────────────────────

  it('V5: rejects maxVotesPerCandidate > 1 when maxVotesPerCategory = 1', () => {
    const errors = validateCampaignRules({
      maxVotesTotal: 0,
      maxVotesPerCategory: 1,
      maxVotesPerCandidate: 3,
    })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('maxVotesPerCategory is 1')
  })

  // ── V6 – Single-total implies single-per-scope ───────────────────────────

  it('V6: rejects maxVotesPerCategory > 1 when maxVotesTotal = 1', () => {
    const errors = validateCampaignRules({
      maxVotesTotal: 1,
      maxVotesPerCategory: 2,
      maxVotesPerCandidate: 1,
    })
    expect(errors.some((e) => e.includes('maxVotesTotal is 1') && e.includes('maxVotesPerCategory'))).toBe(true)
  })

  it('V6: rejects maxVotesPerCandidate > 1 when maxVotesTotal = 1', () => {
    const errors = validateCampaignRules({
      maxVotesTotal: 1,
      maxVotesPerCategory: 1,
      maxVotesPerCandidate: 2,
    })
    expect(errors.some((e) => e.includes('maxVotesTotal is 1') && e.includes('maxVotesPerCandidate'))).toBe(true)
  })

  // ── V7 – Title not empty ─────────────────────────────────────────────────

  it('V7: rejects empty title', () => {
    const errors = validateCampaignRules({
      title: '',
      maxVotesTotal: 1,
      maxVotesPerCategory: 1,
      maxVotesPerCandidate: 1,
    })
    expect(errors.some((e) => e.includes('title'))).toBe(true)
  })

  it('V7: rejects whitespace-only title', () => {
    const errors = validateCampaignRules({
      title: '   ',
      maxVotesTotal: 1,
      maxVotesPerCategory: 1,
      maxVotesPerCandidate: 1,
    })
    expect(errors.some((e) => e.includes('title'))).toBe(true)
  })

  // ── V8 – Valid status ────────────────────────────────────────────────────

  it('V8: accepts all valid statuses', () => {
    for (const status of ['draft', 'active', 'closed']) {
      expect(
        validateCampaignRules({
          status,
          maxVotesTotal: 1,
          maxVotesPerCategory: 1,
          maxVotesPerCandidate: 1,
        }),
      ).toEqual([])
    }
  })

  it('V8: rejects unknown status', () => {
    const errors = validateCampaignRules({
      status: 'paused',
      maxVotesTotal: 1,
      maxVotesPerCategory: 1,
      maxVotesPerCandidate: 1,
    })
    expect(errors.some((e) => e.includes('status'))).toBe(true)
  })

  // ── Multiple errors returned together ────────────────────────────────────

  it('collects multiple errors in one call', () => {
    const errors = validateCampaignRules({
      title: '',
      status: 'invalid',
      maxVotesTotal: 3,
      maxVotesPerCategory: 1,
      maxVotesPerCandidate: 4,
    })
    // Should include V7 (title), V8 (status), V4/V3/V5 (candidate limit) at minimum
    expect(errors.length).toBeGreaterThanOrEqual(3)
  })
})
