import type { Campaign, Suggestion } from '../types'

interface VoteRecord {
  questionId: string
  suggestionId: string
}

export function getClientVoteRecords(
  suggestions: Suggestion[],
  voteCountById: Map<string, number>,
): VoteRecord[] {
  const records: VoteRecord[] = []
  for (const suggestion of suggestions) {
    const count = voteCountById.get(suggestion.id) ?? 0
    for (let i = 0; i < count; i++) {
      records.push({ questionId: suggestion.questionId, suggestionId: suggestion.id })
    }
  }
  return records
}

export function canCastVote(
  campaign: Campaign,
  votes: VoteRecord[],
  questionId: string,
  suggestionId: string,
): boolean {
  const candidateVoteCount = votes.filter((vote) => vote.suggestionId === suggestionId).length
  if (campaign.maxVotesPerCandidate > 0 && candidateVoteCount >= campaign.maxVotesPerCandidate) {
    return false
  }

  const categoryVoteCount = votes.filter((vote) => vote.questionId === questionId).length
  if (campaign.maxVotesPerCategory > 0 && categoryVoteCount >= campaign.maxVotesPerCategory) {
    return false
  }

  const totalVoteCount = votes.length
  if (campaign.maxVotesTotal > 0 && totalVoteCount >= campaign.maxVotesTotal) {
    return false
  }

  return true
}

export function getRemainingVotesTotal(campaign: Campaign, votes: VoteRecord[]): number | null {
  if (campaign.maxVotesTotal <= 0) {
    return null
  }

  return Math.max(0, campaign.maxVotesTotal - votes.length)
}
