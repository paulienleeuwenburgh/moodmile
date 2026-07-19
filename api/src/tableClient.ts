import { TableClient, AzureNamedKeyCredential, TableEntityResult, RestError } from '@azure/data-tables'

const ensuredTables = new Set<string>()

function getTableClient(tableName: string): TableClient {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (connectionString) {
    return TableClient.fromConnectionString(connectionString, tableName)
  }

  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY
  if (accountName && accountKey) {
    const credential = new AzureNamedKeyCredential(accountName, accountKey)
    return new TableClient(
      `https://${accountName}.table.core.windows.net`,
      tableName,
      credential,
    )
  }

  throw new Error(
    'Azure Storage credentials not configured. Set AZURE_STORAGE_CONNECTION_STRING or both AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY.',
  )
}

export async function ensureTableExists(client: TableClient): Promise<void> {
  if (ensuredTables.has(client.tableName)) {
    return
  }

  try {
    await client.createTable()
  } catch (err) {
    if (!(err instanceof RestError) || err.statusCode !== 409) {
      throw err
    }
  }

  ensuredTables.add(client.tableName)
}

/**
 * Partition key for a suggestion row.
 * Format: "{campaignId}|{questionId}"
 */
export function suggestionPartitionKey(campaignId: string, questionId: string): string {
  return `${campaignId}|${questionId}`
}

/**
 * Partition key for a vote row.
 * Format: "{campaignId}|{sessionId}"
 */
export function votePartitionKey(campaignId: string, sessionId: string): string {
  return `${campaignId}|${sessionId}`
}

export interface SuggestionEntity {
  partitionKey: string // "{campaignId}|{questionId}"
  rowKey: string       // suggestionId
  campaignId: string
  questionId: string
  name: string
  createdAt: string
  votes: number
}

export interface VoteEntity {
  partitionKey: string // "{campaignId}|{sessionId}"
  rowKey: string       // suggestionId
  questionId: string
  createdAt: string
}

export function getSuggestionsClient(): TableClient {
  return getTableClient('suggestions')
}

export function getVotesClient(): TableClient {
  return getTableClient('votes')
}

export function entityToSuggestion(entity: TableEntityResult<SuggestionEntity>) {
  // partitionKey is always in the format "{campaignId}|{questionId}" for entities
  // created by this application. The campaignId and questionId properties are stored
  // explicitly on the entity, with the split used only as a fallback for older rows.
  const [fallbackCampaignId, fallbackQuestionId] = entity.partitionKey.split('|')
  return {
    id: entity.rowKey,
    campaignId: entity.campaignId ?? fallbackCampaignId ?? '',
    questionId: entity.questionId ?? fallbackQuestionId ?? '',
    name: entity.name,
    createdAt: entity.createdAt,
    votes: entity.votes ?? 0,
  }
}
