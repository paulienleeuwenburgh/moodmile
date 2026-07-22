import { describe, expect, it } from 'vitest'
import type { Campaign, Suggestion } from '../types'
import { canCastVote, getClientVoteRecords, getRemainingVotesTotal } from './voteLimits'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseCampaign: Campaign = {
  id: 'test-campaign',
  title: 'Test',
  description: '',
  status: 'active',
  createdAt: '2024-01-01T00:00:00.000Z',
  allowSuggestions: true,
  maxVotesTotal: 3,
  maxVotesPerCategory: 0,
  maxVotesPerCandidate: 2,
}

const marja: Suggestion = {
  id: 'marja',
  campaignId: 'test-campaign',
  questionId: 'q-1',
  name: 'Marja',
  createdAt: '2024-01-01T00:00:00.000Z',
  votes: 2,
}

const rogier: Suggestion = {
  id: 'rogier',
  campaignId: 'test-campaign',
  questionId: 'q-1',
  name: 'Rogier',
  createdAt: '2024-01-02T00:00:00.000Z',
  votes: 1,
}

// ---------------------------------------------------------------------------
// getClientVoteRecords
// ---------------------------------------------------------------------------

describe('getClientVoteRecords', () => {
  it('returns empty array when no votes', () => {
    expect(getClientVoteRecords([marja, rogier], new Map())).toEqual([])
  })

  it('builds one record per vote for visible candidates', () => {
    const counts = new Map([
      ['marja', 2],
      ['rogier', 1],
    ])
    const records = getClientVoteRecords([marja, rogier], counts)
    expect(records).toHaveLength(3)
    expect(records.filter((r) => r.suggestionId === 'marja')).toHaveLength(2)
    expect(records.filter((r) => r.suggestionId === 'rogier')).toHaveLength(1)
    expect(records.find((r) => r.suggestionId === 'marja')?.questionId).toBe('q-1')
    expect(records.find((r) => r.suggestionId === 'rogier')?.questionId).toBe('q-1')
  })

  it('includes votes for soft-deleted candidates absent from suggestions', () => {
    // Marja has been soft-deleted — no longer in suggestions, but her votes remain.
    const counts = new Map([
      ['marja', 2],
      ['rogier', 1],
    ])
    const records = getClientVoteRecords([rogier], counts)
    expect(records).toHaveLength(3)
    expect(records.filter((r) => r.suggestionId === 'marja')).toHaveLength(2)
    expect(records.filter((r) => r.suggestionId === 'rogier')).toHaveLength(1)
  })

  it('uses empty string as questionId for soft-deleted candidates', () => {
    const counts = new Map([['marja', 2]])
    const records = getClientVoteRecords([], counts)
    expect(records).toHaveLength(2)
    expect(records.every((r) => r.questionId === '')).toBe(true)
  })

  it('preserves questionId for visible candidates', () => {
    const counts = new Map([['rogier', 1]])
    const records = getClientVoteRecords([rogier], counts)
    expect(records).toHaveLength(1)
    expect(records[0].questionId).toBe('q-1')
  })
})

// ---------------------------------------------------------------------------
// getRemainingVotesTotal
// ---------------------------------------------------------------------------

describe('getRemainingVotesTotal', () => {
  it('returns null when maxVotesTotal is 0 (unlimited)', () => {
    const unlimited = { ...baseCampaign, maxVotesTotal: 0 }
    expect(getRemainingVotesTotal(unlimited, [])).toBeNull()
  })

  it('returns full budget when no votes have been cast', () => {
    expect(getRemainingVotesTotal(baseCampaign, [])).toBe(3)
  })

  it('accounts for votes including those for deleted candidates', () => {
    const counts = new Map([
      ['marja', 2],
      ['rogier', 1],
    ])
    // Marja is deleted; only Rogier is in suggestions
    const records = getClientVoteRecords([rogier], counts)
    expect(getRemainingVotesTotal(baseCampaign, records)).toBe(0)
  })

  it('never returns a negative number', () => {
    const counts = new Map([['marja', 5]])
    const records = getClientVoteRecords([], counts)
    expect(getRemainingVotesTotal(baseCampaign, records)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// canCastVote — total limit
// ---------------------------------------------------------------------------

describe('canCastVote – total limit', () => {
  it('allows a vote when total budget is not exhausted', () => {
    const counts = new Map([['rogier', 1]])
    const records = getClientVoteRecords([rogier], counts)
    expect(canCastVote(baseCampaign, records, 'q-1', 'rogier')).toBe(true)
  })

  it('blocks a vote when total budget is exhausted by votes for active candidates', () => {
    const counts = new Map([
      ['rogier', 2],
      ['marja', 1],
    ])
    const records = getClientVoteRecords([rogier, marja], counts)
    expect(canCastVote(baseCampaign, records, 'q-1', 'rogier')).toBe(false)
  })

  it('blocks a vote when total budget is exhausted by votes including deleted candidates', () => {
    // Marja soft-deleted; Rogier visible. 2 + 1 = 3 = maxVotesTotal.
    const counts = new Map([
      ['marja', 2],
      ['rogier', 1],
    ])
    const records = getClientVoteRecords([rogier], counts)
    expect(canCastVote(baseCampaign, records, 'q-1', 'rogier')).toBe(false)
  })
})
