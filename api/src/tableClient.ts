import { TableClient, AzureNamedKeyCredential, TableEntityResult, RestError } from '@azure/data-tables'
import type { QuestionType } from './responseValidation'

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

// ─── Campaign entities ────────────────────────────────────────────────────────

/**
 * Campaign row in the 'campaigns' table.
 * partitionKey = 'campaign'  (constant – groups all campaigns in one partition)
 * rowKey       = campaignId  (e.g. 'ninja-naming')
 *
 * Image ownership: campaigns may own a bannerImageUrl (hero section).
 */
export interface CampaignEntity {
  partitionKey: string
  rowKey: string       // campaignId
  title: string
  description: string
  status: string       // 'draft' | 'active' | 'closed'
  maxVotesTotal: number
  maxVotesPerCategory: number
  maxVotesPerCandidate: number
  createdAt: string
  updatedAt: string
  /**
   * Optional hero/banner image URL for the campaign.
   * Supported schemes: https:// or a relative path starting with /.
   * Set or update this field in Azure Table Storage to change the banner without redeployment.
   */
  bannerImageUrl?: string
}

/**
 * Question row in the 'questions' table.
 * partitionKey = campaignId  (e.g. 'ninja-naming')
 * rowKey       = questionId  (e.g. 'ninja-1')
 *
 * Image ownership: questions may own an imageUrl (category/question thumbnail).
 */
export interface QuestionEntity {
  partitionKey: string // campaignId
  rowKey: string       // questionId
  title: string
  description: string
  status?: string
  questionType: string
  allowSuggestions?: boolean
  required?: boolean
  maxSize?: number
  numberOfVotes?: number
  duplicateVotingAllowed?: boolean
  options?: string
  numericMin?: number
  numericMax?: number
  imageUrl?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

function normalizeQuestionType(value: string): QuestionType | string {
  const normalized = value.trim().toLocaleLowerCase()
  const supportedType = ['categorical', 'boolean', 'ordinal', 'numeric', 'text']
    .find((type) => type === normalized)
  return supportedType ?? value
}

function normalizeBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value.trim().toLocaleLowerCase() === 'true') return true
    if (value.trim().toLocaleLowerCase() === 'false') return false
  }
  return value as boolean
}

function normalizeNumber(value: unknown, defaultValue?: number): number | undefined {
  if (value === undefined) return defaultValue
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return value as number
}

export function getCampaignsClient(): TableClient {
  return getTableClient('campaigns')
}

export function getQuestionsClient(): TableClient {
  return getTableClient('questions')
}

export function entityToCampaignConfig(entity: TableEntityResult<CampaignEntity>) {
  return {
    id: entity.rowKey as string,
    title: entity.title,
    description: entity.description,
    status: entity.status,
    maxVotesTotal: entity.maxVotesTotal,
    maxVotesPerCategory: entity.maxVotesPerCategory,
    maxVotesPerCandidate: entity.maxVotesPerCandidate,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    bannerImageUrl: entity.bannerImageUrl,
  }
}

export function entityToQuestion(entity: TableEntityResult<QuestionEntity>) {
  const questionType = normalizeQuestionType(entity.questionType) as QuestionType
  let options: string[] | undefined
  if (typeof entity.options === 'string') {
    try {
      const parsed: unknown = JSON.parse(entity.options)
      if (Array.isArray(parsed) && parsed.every((option) => typeof option === 'string')) {
        options = parsed
      }
    } catch {
      options = undefined
    }
  }
  return {
    id: entity.rowKey as string,
    campaignId: entity.partitionKey as string,
    title: entity.title,
    description: entity.description,
    status: entity.status,
    questionType,
    allowSuggestions: questionType === 'text' ? normalizeBoolean(entity.allowSuggestions, true) : false,
    required: normalizeBoolean(entity.required, false),
    maxSize: questionType === 'text' ? normalizeNumber(entity.maxSize, 250) : undefined,
    numberOfVotes: questionType === 'text' ? normalizeNumber(entity.numberOfVotes, 0)
      : questionType === 'categorical' ? normalizeNumber(entity.numberOfVotes, 1)
        : undefined,
    duplicateVotingAllowed: questionType === 'text' || questionType === 'categorical'
      ? normalizeBoolean(entity.duplicateVotingAllowed, false)
      : undefined,
    options,
    numericMin: normalizeNumber(entity.numericMin),
    numericMax: normalizeNumber(entity.numericMax),
    imageUrl: entity.imageUrl,
    sortOrder: entity.sortOrder,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  }
}

// ─── Suggestion / Vote entities ───────────────────────────────────────────────

/**
 * Suggestion (candidate) row in the 'suggestions' table.
 * partitionKey = "{campaignId}|{questionId}"
 * rowKey       = suggestionId (UUID)
 *
 * Image ownership: suggestions/candidates may own an imageUrl (candidate avatar).
 * Soft-delete: set isDeleted = true to hide a candidate without losing vote history.
 * Soft-deleted candidates are excluded from GET /api/suggestions results and from
 * rankings. Restoring (isDeleted = false) allows voting again with vote history intact.
 */
export interface SuggestionEntity {
  partitionKey: string // "{campaignId}|{questionId}"
  rowKey: string       // suggestionId
  campaignId: string
  questionId: string
  sessionId?: string
  name: string
  createdAt: string
  votes: number
  /**
   * Optional candidate image URL.
   * Supported schemes: https:// or a relative path starting with /.
   */
  imageUrl?: string
  /** Soft-delete flag. When true the candidate is hidden from all public views. */
  isDeleted?: boolean
  /** ISO timestamp of when the candidate was soft-deleted. */
  deletedAt?: string
  /** Identifier of the admin who performed the deletion (free-form string). */
  deletedBy?: string
  /** Optional reason supplied by the admin at time of deletion. */
  deleteReason?: string
}

export interface VoteEntity {
  partitionKey: string // "{campaignId}|{sessionId}"
  rowKey: string       // suggestionId, or "{suggestionId}|{uuid}" for multi-votes
  questionId: string
  suggestionId: string // stored explicitly to support per-candidate queries
  createdAt: string
}

export interface QuestionResponseEntity {
  partitionKey: string // "{campaignId}|{questionId}"
  rowKey: string // sessionId
  campaignId: string
  questionId: string
  answer: string // JSON-serialized string, string[], boolean, or number
  createdAt: string
}

export function getSuggestionsClient(): TableClient {
  return getTableClient('suggestions')
}

export function getVotesClient(): TableClient {
  return getTableClient('votes')
}

export function getQuestionResponsesClient(): TableClient {
  return getTableClient('questionResponses')
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
    imageUrl: entity.imageUrl,
  }
}
