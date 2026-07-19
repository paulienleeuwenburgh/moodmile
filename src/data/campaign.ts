import type { Campaign, Question } from '../types'

export const defaultCampaign: Campaign = {
  id: 'ninja-naming',
  title: 'These four ninjas need names',
  description: 'Help us name our four ninja mascots by suggesting and voting for your favorites.',
  status: 'active',
  createdAt: '2024-01-01T00:00:00.000Z',
  allowSuggestions: true,
  maxVotesPerUser: 4,
  allowMultipleVotesPerSuggestion: false,
  votingMode: 'standard',
}

export const questions: Question[] = [
  {
    id: 'ninja-1',
    campaignId: 'ninja-naming',
    title: 'Ninja 1',
    description: 'This ninja needs a name.',
    imageUrl: '/mascots/ninja1.png',
    sortOrder: 1,
  },
  {
    id: 'ninja-2',
    campaignId: 'ninja-naming',
    title: 'Ninja 2',
    description: 'This ninja needs a name.',
    imageUrl: '/mascots/ninja2.png',
    sortOrder: 2,
  },
  {
    id: 'ninja-3',
    campaignId: 'ninja-naming',
    title: 'Ninja 3',
    description: 'This ninja needs a name.',
    imageUrl: '/mascots/ninja3.png',
    sortOrder: 3,
  },
  {
    id: 'ninja-4',
    campaignId: 'ninja-naming',
    title: 'Ninja 4',
    description: 'This ninja needs a name.',
    imageUrl: '/mascots/ninja4.png',
    sortOrder: 4,
  },
]
