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
): { allowed: true } | { allowed: false; error: string } {
  const candidateVoteCount = votes.filter((vote) => vote.suggestionId === suggestionId).length
  if (campaign.maxVotesPerCandidate > 0 && candidateVoteCount >= campaign.maxVotesPerCandidate) {
    return {
      allowed: false,
      error: `You have already cast the maximum of ${campaign.maxVotesPerCandidate} vote(s) for this candidate`,
    }
  }

  const categoryVoteCount = votes.filter((vote) => vote.questionId === questionId).length
  if (campaign.maxVotesPerCategory > 0 && categoryVoteCount >= campaign.maxVotesPerCategory) {
    return {
      allowed: false,
      error: `You have reached the maximum of ${campaign.maxVotesPerCategory} vote(s) for this category`,
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
