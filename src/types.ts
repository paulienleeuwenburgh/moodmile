export interface Campaign {
  id: string
  title: string
  description: string
  status: string
  createdAt: string
  allowSuggestions: boolean
  maxVotesPerUser: number
  allowMultipleVotesPerSuggestion: boolean
  votingMode: string
}

export interface Question {
  id: string
  campaignId: string
  title: string
  description: string
  imageUrl?: string
  sortOrder: number
}

export interface Suggestion {
  id: string
  campaignId: string
  questionId: string
  name: string
  createdAt: string
  votes: number
}

export interface Vote {
  campaignId: string
  questionId: string
  suggestionId: string
  sessionId: string
  createdAt: string
}
