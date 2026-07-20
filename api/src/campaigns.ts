export interface CampaignConfig {
  id: string
  title: string
  description: string
  status: string
  allowSuggestions: boolean
  /** Maximum votes a user may cast across the entire campaign. 0 = unlimited. */
  maxVotesTotal: number
  /** Maximum votes a user may cast within a single category (question). 0 = unlimited. */
  maxVotesPerCategory: number
  /** Maximum votes a user may cast for a single candidate (suggestion). 0 = unlimited. */
  maxVotesPerCandidate: number
}

export const campaigns: CampaignConfig[] = [
  {
    id: 'ninja-naming',
    title: 'These four ninjas need names',
    description: 'Help us name our four ninja mascots by suggesting and voting for your favorites.',
    status: 'active',
    allowSuggestions: true,
    maxVotesTotal: 4,
    maxVotesPerCategory: 1,
    maxVotesPerCandidate: 1,
  },
]

export function getCampaign(campaignId: string): CampaignConfig | undefined {
  return campaigns.find((c) => c.id === campaignId)
}
