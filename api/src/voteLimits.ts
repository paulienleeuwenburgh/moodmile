import type { CampaignConfig } from './campaigns'

export interface VoteRecord {
  questionId: string
  suggestionId: string
}

export function filterVoteRecordsByActiveSuggestions(
  votes: VoteRecord[],
  activeSuggestionIds: Set<string>,
): VoteRecord[] {
  return votes.filter((vote) => activeSuggestionIds.has(vote.suggestionId))
}

export function canCastVote(
  campaign: CampaignConfig,
  votes: VoteRecord[],
  questionId: string,
  suggestionId: string,
  numberOfVotes = 0,
  duplicateVotingAllowed = false,
): { allowed: true } | { allowed: false; error: string } {
  if (numberOfVotes <= 0) {
    return { allowed: false, error: 'Voting is not enabled for this question' }
  }

  const candidateVoteCount = votes.filter((vote) => vote.suggestionId === suggestionId).length
  const maxVotesPerCandidate = duplicateVotingAllowed ? campaign.maxVotesPerCandidate : 1
  if (maxVotesPerCandidate > 0 && candidateVoteCount >= maxVotesPerCandidate) {
    return {
      allowed: false,
      error: `You have already cast the maximum of ${maxVotesPerCandidate} vote(s) for this candidate`,
    }
  }

  const categoryVoteCount = votes.filter((vote) => vote.questionId === questionId).length
  const maxVotesPerCategory = campaign.maxVotesPerCategory > 0
    ? Math.min(campaign.maxVotesPerCategory, numberOfVotes)
    : numberOfVotes
  if (categoryVoteCount >= maxVotesPerCategory) {
    return {
      allowed: false,
      error: `You have reached the maximum of ${maxVotesPerCategory} vote(s) for this category`,
    }
  }

  const totalVoteCount = votes.length
  if (campaign.maxVotesTotal > 0 && totalVoteCount >= campaign.maxVotesTotal) {
    return {
      allowed: false,
      error: `You have reached the maximum of ${campaign.maxVotesTotal} total vote(s) for this campaign`,
    }
  }

  return { allowed: true }
}
