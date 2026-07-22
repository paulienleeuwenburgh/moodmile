import type { Campaign, Suggestion } from '../types'

interface VoteRecord {
  questionId: string
  suggestionId: string
}

export function getClientVoteRecords(
  suggestions: Suggestion[],
  voteCountById: Map<string, number>,
): VoteRecord[] {
  // Build a lookup from suggestionId → questionId for visible (non-deleted) candidates.
  // Votes for soft-deleted candidates are absent from `suggestions` but still present in
  // `voteCountById` (the backend never removes vote rows on soft delete). Those votes must
  // still count against the user's budget — use an empty questionId as a placeholder so
  // they are included in the total count without being attributed to any live category.
  const questionBySuggestionId = new Map(suggestions.map((s) => [s.id, s.questionId]))
  const records: VoteRecord[] = []
  for (const [suggestionId, count] of voteCountById) {
    const questionId = questionBySuggestionId.get(suggestionId) ?? ''
    for (let i = 0; i < count; i++) {
      records.push({ questionId, suggestionId })
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
