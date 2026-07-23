import { RestError } from '@azure/data-tables'
import {
  getCampaignsClient,
  ensureTableExists,
  entityToCampaignConfig,
  type CampaignEntity,
} from './tableClient'

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
  /** Optional hero/banner image URL. */
  bannerImageUrl?: string
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

