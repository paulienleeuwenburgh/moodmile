import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { entityToSuggestion, getSuggestionsClient, SuggestionEntity } from '../tableClient'
import { escapeODataString } from '../odata'

async function getSuggestions(
  _request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const client = getSuggestionsClient()
  const suggestions = []
  for await (const entity of client.listEntities<SuggestionEntity>()) {
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
  const body = (await request.json()) as { mascotId?: string; name?: string }
  const mascotId = body.mascotId?.trim()
  const name = body.name?.trim()

  if (!mascotId || !name) {
    return { status: 400, jsonBody: { error: 'mascotId and name are required' } }
  }

  const client = getSuggestionsClient()

  // Duplicate check: normalise to lowercase and compare
  const normalised = name.toLowerCase()
  for await (const entity of client.listEntities<SuggestionEntity>({
    queryOptions: { filter: `PartitionKey eq '${escapeODataString(mascotId)}'` },
  })) {
    if (entity.name.trim().toLowerCase() === normalised) {
      return {
        status: 409,
        jsonBody: { error: 'A suggestion with that name already exists for this mascot.' },
      }
    }
  }

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  await client.createEntity({
    partitionKey: mascotId,
    rowKey: id,
    name,
    createdAt,
    votes: 0,
  })

  return {
    status: 201,
    jsonBody: { id, mascotId, name, createdAt, votes: 0 },
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
