import { describe, expect, it } from 'vitest'
import { canCastVote, filterVoteRecordsByActiveSuggestions, type VoteRecord } from './voteLimits'

const campaign = {
  id: 'test-campaign',
  title: 'Test',
  description: '',
  status: 'active',
  allowSuggestions: true,
  maxVotesTotal: 3,
  maxVotesPerCategory: 0,
  maxVotesPerCandidate: 2,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

const allVotes: VoteRecord[] = [
  { questionId: 'q-1', suggestionId: 'marja' },
  { questionId: 'q-1', suggestionId: 'marja' },
  { questionId: 'q-1', suggestionId: 'rogier' },
]

describe('filterVoteRecordsByActiveSuggestions', () => {
  it('removes votes for soft-deleted candidates', () => {
    const filtered = filterVoteRecordsByActiveSuggestions(allVotes, new Set(['rogier']))
    expect(filtered).toEqual([{ questionId: 'q-1', suggestionId: 'rogier' }])
  })

  it('restores preserved votes to budget calculations when the candidate becomes active again', () => {
    const filtered = filterVoteRecordsByActiveSuggestions(allVotes, new Set(['marja', 'rogier']))
    expect(filtered).toHaveLength(3)
    expect(filtered.filter((vote) => vote.suggestionId === 'marja')).toHaveLength(2)
  })
})

describe('canCastVote with active vote filtering', () => {
  it('allows a vote after soft delete releases preserved votes', () => {
    const activeVotes = filterVoteRecordsByActiveSuggestions(allVotes, new Set(['rogier']))
    expect(canCastVote(campaign, activeVotes, 'q-1', 'rogier')).toEqual({ allowed: true })
  })

  it('blocks a vote again after restore re-activates preserved votes', () => {
    const activeVotes = filterVoteRecordsByActiveSuggestions(allVotes, new Set(['marja', 'rogier']))
    expect(canCastVote(campaign, activeVotes, 'q-1', 'rogier')).toEqual({
      allowed: false,
      error: 'You have reached the maximum of 3 total vote(s) for this campaign',
    })
  })
})
