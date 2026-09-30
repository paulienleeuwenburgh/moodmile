import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import type { TableEntityResult } from '@azure/data-tables'
import {
  ensureTableExists,
  entityToSuggestion,
  getSuggestionsClient,
  suggestionPartitionKey,
  SuggestionEntity,
} from '../tableClient'
import { escapeODataString } from '../odata'
import { getQuestionConfig } from '../campaigns'
import { validateSuggestion } from '../suggestionValidation'
import { shouldDisplayAllSubmissions } from '../suggestionVisibility'

async function getSuggestions(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const campaignId = request.query.get('campaignId')
  const sessionId = request.query.get('sessionId')?.trim() || undefined
  const client = getSuggestionsClient()
  await ensureTableExists(client)

  // Filter all partition keys that start with "{campaignId}|".
  // '~' (ASCII 126) is one above '|' (ASCII 124), giving a correct lexicographic upper bound.
  const partitionFilter = campaignId
    ? `PartitionKey ge '${escapeODataString(campaignId)}|' and PartitionKey lt '${escapeODataString(campaignId)}~'`
    : undefined

  // Exclude soft-deleted suggestions. OData `ne true` also matches absent/null boolean fields,
  // so this safely excludes deleted entries while including all rows that have never been deleted.
  const deletedFilter = `isDeleted ne true`
  const filter = partitionFilter ? `${partitionFilter} and ${deletedFilter}` : deletedFilter

  const entities: TableEntityResult<SuggestionEntity>[] = []
  for await (const entity of client.listEntities<SuggestionEntity>({
    queryOptions: { filter },
  })) {
    entities.push(entity)
  }

  // Resolve the (campaignId, questionId) pair and cache key consistently for every entity,
  // so the lookup phase and the filtering phase below can never drift out of sync — a
  // mismatch there would silently (and incorrectly) trigger the fail-closed path.
  function questionCacheKeyFor(entity: TableEntityResult<SuggestionEntity>) {
    const entityCampaignId = entity.campaignId ?? campaignId ?? ''
    const questionId = entity.questionId
    return { entityCampaignId, questionId, cacheKey: `${entityCampaignId}|${questionId}` }
  }

  // Resolve one question config per distinct (campaignId, questionId) pair, in parallel,
  // instead of sequentially inside the loop below. A `null` cache entry means the question's
  // config could not be determined (lookup failed, or the question no longer exists) — treated
  // as fail-closed below, rather than assuming the question allows public visibility.
  const cacheKeys = new Map<string, { entityCampaignId: string; questionId: string }>()
  for (const entity of entities) {
    const { entityCampaignId, questionId, cacheKey } = questionCacheKeyFor(entity)
    cacheKeys.set(cacheKey, { entityCampaignId, questionId })
  }

  const questionConfigCache = new Map<string, Awaited<ReturnType<typeof getQuestionConfig>> | null>()
  await Promise.all(
    Array.from(cacheKeys.entries()).map(async ([cacheKey, { entityCampaignId, questionId }]) => {
      // A single misconfigured question (e.g. a draft still being set up) must not take
      // down the whole suggestions list.
      try {
        const config = await getQuestionConfig(entityCampaignId, questionId)
        questionConfigCache.set(cacheKey, config ?? null)
      } catch (err) {
        context.warn(
          `Hiding submissions for invalid question "${questionId}" in campaign "${entityCampaignId}": ${err instanceof Error ? err.message : String(err)}`,
        )
        questionConfigCache.set(cacheKey, null)
      }
    }),
  )

  // NOTE: sessionId is a client-generated, unauthenticated identifier (see getSessionId()).
  // This filter is a best-effort UI convenience, not an access-control boundary: anyone who
  // learns another session's ID could still match against it. Do not rely on this for
  // protecting sensitive data.
  const suggestions = []
  for (const entity of entities) {
    const { cacheKey } = questionCacheKeyFor(entity)
    const question = questionConfigCache.get(cacheKey)

    // When a question restricts visibility to the owner's own submissions
    // (displaySubmissions=false and voting is not enabled), only include
    // suggestions created by the requesting session. A missing/blank sessionId never
    // matches, even against suggestions stored without a sessionId of their own.
    // If the question's config could not be determined (lookup failed, or the question
    // no longer exists), fail closed and apply the same own-submissions-only restriction
    // rather than assuming the question is public.
    const isVisible =
      (question != null && shouldDisplayAllSubmissions(question)) ||
      (Boolean(sessionId) && entity.sessionId === sessionId)
    if (!isVisible) {
      continue
    }

    suggestions.push(entityToSuggestion(entity))
  }
  return {
    status: 200,
    jsonBody: suggestions,
    headers: { 'Content-Type': 'application/json' },
  }
}

async function postSuggestion(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const body = (await request.json()) as { campaignId?: string; questionId?: string; name?: string; sessionId?: string }
  const campaignId = body.campaignId?.trim()
  const questionId = body.questionId?.trim()
  const sessionId = body.sessionId?.trim()
  const name = body.name?.trim()

  if (!campaignId || !questionId || !name) {
    return { status: 400, jsonBody: { error: 'campaignId, questionId and name are required' } }
  }

  const question = await getQuestionConfig(campaignId, questionId)
  if (!question) {
    return { status: 404, jsonBody: { error: 'Question not found' } }
  }

  if (question.questionType !== 'text') {
    return { status: 400, jsonBody: { error: 'Suggestions are only supported for text questions' } }
  }
  const validationError = validateSuggestion(name, question.maxSize ?? 250)
  if (validationError) {
    return { status: 400, jsonBody: { error: validationError } }
  }
  if (!question.allowSuggestions) {
    return { status: 403, jsonBody: { error: 'Suggestions are not allowed for this question' } }
  }

  const client = getSuggestionsClient()
  await ensureTableExists(client)
  const partitionKey = suggestionPartitionKey(campaignId, questionId)

  // Duplicate check: normalise to lowercase and compare
  const normalised = name.toLowerCase()
  for await (const entity of client.listEntities<SuggestionEntity>({
    queryOptions: {
      filter: `PartitionKey eq '${escapeODataString(partitionKey)}' and isDeleted ne true`,
    },
  })) {
    if (entity.name.trim().toLowerCase() === normalised) {
      return {
        status: 409,
        jsonBody: { error: 'A suggestion with that name already exists for this question.' },
      }
    }
  }

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  await client.createEntity({
    partitionKey,
    rowKey: id,
    campaignId,
    questionId,
    sessionId,
    name,
    createdAt,
    votes: 0,
    isDeleted: false,
  })

  return {
    status: 201,
    jsonBody: { id, campaignId, questionId, name, createdAt, votes: 0 },
    headers: { 'Content-Type': 'application/json' },
  }
}

app.http('getSuggestions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'suggestions',
  handler: getSuggestions,
})

app.http('postSuggestion', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'suggestions',
  handler: postSuggestion,
})
