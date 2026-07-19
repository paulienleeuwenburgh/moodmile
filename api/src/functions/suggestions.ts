import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { entityToSuggestion, getSuggestionsClient, suggestionPartitionKey, SuggestionEntity } from '../tableClient'
import { escapeODataString } from '../odata'
import { getCampaign } from '../campaigns'

async function getSuggestions(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const campaignId = request.query.get('campaignId')
  const client = getSuggestionsClient()
  const suggestions = []

  // Filter all partition keys that start with "{campaignId}|".
  // '~' (ASCII 126) is one above '|' (ASCII 124), giving a correct lexicographic upper bound.
  const filter = campaignId
    ? `PartitionKey ge '${escapeODataString(campaignId)}|' and PartitionKey lt '${escapeODataString(campaignId)}~'`
    : undefined

  for await (const entity of client.listEntities<SuggestionEntity>({
    queryOptions: filter ? { filter } : undefined,
  })) {
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
  const body = (await request.json()) as { campaignId?: string; questionId?: string; name?: string }
  const campaignId = body.campaignId?.trim()
  const questionId = body.questionId?.trim()
  const name = body.name?.trim()

  if (!campaignId || !questionId || !name) {
    return { status: 400, jsonBody: { error: 'campaignId, questionId and name are required' } }
  }

  const campaign = getCampaign(campaignId)
  if (!campaign) {
    return { status: 404, jsonBody: { error: 'Campaign not found' } }
  }

  if (!campaign.allowSuggestions) {
    return { status: 403, jsonBody: { error: 'Suggestions are not allowed for this campaign' } }
  }

  const client = getSuggestionsClient()
  const partitionKey = suggestionPartitionKey(campaignId, questionId)

  // Duplicate check: normalise to lowercase and compare
  const normalised = name.toLowerCase()
  for await (const entity of client.listEntities<SuggestionEntity>({
    queryOptions: { filter: `PartitionKey eq '${escapeODataString(partitionKey)}'` },
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
    name,
    createdAt,
    votes: 0,
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
