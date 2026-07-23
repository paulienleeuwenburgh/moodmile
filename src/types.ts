export interface Campaign {
  id: string
  title: string
  description: string
  status: string
  createdAt: string
  updatedAt?: string
  allowSuggestions: boolean
  /** Maximum votes a user may cast across the entire campaign. 0 = unlimited. */
  maxVotesTotal: number
  /** Maximum votes a user may cast within a single category (question). 0 = unlimited. */
  maxVotesPerCategory: number
  /** Maximum votes a user may cast for a single candidate (suggestion). 0 = unlimited. */
  maxVotesPerCandidate: number
  /**
   * Optional banner image URL for the campaign hero section.
   * Supported schemes: https:// or a relative path starting with /.
   * Can be set in Azure Table Storage without redeployment.
   */
  bannerImageUrl?: string
}

export interface Question {
  id: string
  campaignId: string
  title: string
  description: string
  imageUrl?: string
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export interface Suggestion {
  id: string
  campaignId: string
  questionId: string
  name: string
  createdAt: string
  votes: number
  /**
   * Optional candidate image URL.
   * Supported schemes: https:// or a relative path starting with /.
   * Can be set in Azure Table Storage without redeployment.
   */
  imageUrl?: string
}

export interface Vote {
  campaignId: string
  questionId: string
  suggestionId: string
  sessionId: string
  createdAt: string
}
