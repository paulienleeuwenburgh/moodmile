export interface CampaignConfig {
  id: string
  title: string
  description: string
  status: string
  allowSuggestions: boolean
  maxVotesPerUser: number
  allowMultipleVotesPerSuggestion: boolean
  votingMode: string
}

export const campaigns: CampaignConfig[] = [
  {
    id: 'ninja-naming',
    title: 'These four ninjas need names',
    description: 'Help us name our four ninja mascots by suggesting and voting for your favorites.',
    status: 'active',
    allowSuggestions: true,
    maxVotesPerUser: 4,
    allowMultipleVotesPerSuggestion: false,
    votingMode: 'standard',
  },
]

export function getCampaign(campaignId: string): CampaignConfig | undefined {
  return campaigns.find((c) => c.id === campaignId)
}
