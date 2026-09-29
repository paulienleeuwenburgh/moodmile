import { RestError } from '@azure/data-tables'
import {
  getCampaignsClient,
  ensureTableExists,
  entityToCampaignConfig,
  type CampaignEntity,
  entityToQuestion,
  getQuestionsClient,
  type QuestionEntity,
} from './tableClient'
import { validateQuestion } from './responseValidation'

export interface CampaignConfig {
  id: string
  title: string
  description: string
  status: string
  /** Maximum votes a user may cast across the entire campaign. 0 = unlimited. */
  maxVotesTotal: number
  /** Maximum votes a user may cast within a single category (question). 0 = unlimited. */
  maxVotesPerCategory: number
  /** Maximum votes a user may cast for a single candidate (suggestion). 0 = unlimited. */
  maxVotesPerCandidate: number
  /** Optional hero/banner image URL. */
  bannerImageUrl?: string
}

export async function getQuestionConfig(campaignId: string, questionId: string) {
  const [questionsClient, campaignsClient] = [getQuestionsClient(), getCampaignsClient()]
  await Promise.all([ensureTableExists(questionsClient), ensureTableExists(campaignsClient)])
  try {
    const entity = await questionsClient.getEntity<QuestionEntity>(campaignId, questionId)
    const question = entityToQuestion(entity)
    if (entity.allowSuggestions === undefined) {
      try {
        const legacyCampaign = await campaignsClient.getEntity<CampaignEntity>('campaign', campaignId)
        question.allowSuggestions = Boolean(legacyCampaign.allowSuggestions)
        question.allowVoting = true
      } catch {
        question.allowSuggestions = false
        question.allowVoting = true
      }
    }
    const errors = validateQuestion(question)
    if (errors.length > 0) {
      throw new Error(`Invalid question configuration for "${questionId}": ${errors.join(' ')}`)
    }
    return question
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) {
      return undefined
    }
    throw err
  }
}

/**
 * Load a campaign by ID from Azure Table Storage.
 * Returns undefined if not found.
 */
export async function getCampaign(campaignId: string): Promise<CampaignConfig | undefined> {
  const client = getCampaignsClient()
  await ensureTableExists(client)
  try {
    const entity = await client.getEntity<CampaignEntity>('campaign', campaignId)
    return entityToCampaignConfig(entity)
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) {
      return undefined
    }
    throw err
  }
}

/**
 * Return the first active campaign found in Azure Table Storage.
 * Returns undefined if no active campaign exists.
 */
export async function getActiveCampaign(): Promise<CampaignConfig | undefined> {
  const client = getCampaignsClient()
  await ensureTableExists(client)
  for await (const entity of client.listEntities<CampaignEntity>({
    queryOptions: { filter: "PartitionKey eq 'campaign' and status eq 'active'" },
  })) {
    return entityToCampaignConfig(entity)
  }
  return undefined
}
