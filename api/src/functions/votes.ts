import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { RestError } from '@azure/data-tables'
import { entityToSuggestion, getSuggestionsClient, getVotesClient, SuggestionEntity } from '../tableClient'
import { escapeODataString } from '../odata'

async function getVotes(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const sessionId = request.query.get('sessionId')
  if (!sessionId) {
    return { status: 400, jsonBody: { error: 'sessionId query parameter is required' } }
  }

  const client = getVotesClient()
  const votedIds: string[] = []
  for await (const entity of client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${escapeODataString(sessionId)}'` },
  })) {
    votedIds.push(entity.rowKey as string)
  }

  return {
    status: 200,
    jsonBody: votedIds,
    headers: { 'Content-Type': 'application/json' },
  }
}

async function postVote(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const body = (await request.json()) as { sessionId?: string; suggestionId?: string; revoke?: boolean }
  const { sessionId, suggestionId, revoke } = body

  if (!sessionId || !suggestionId) {
    return { status: 400, jsonBody: { error: 'sessionId and suggestionId are required' } }
  }

  const votesClient = getVotesClient()
  const suggestionsClient = getSuggestionsClient()

  // Check current vote state
  let alreadyVoted = false
  try {
    await votesClient.getEntity(sessionId, suggestionId)
    alreadyVoted = true
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) {
      alreadyVoted = false
    } else {
      throw err
    }
  }

  // Fetch suggestion to update its vote count
  // rowKey is suggestionId, partitionKey is mascotId — query by RowKey across all partitions
  let suggestionEntity: import('@azure/data-tables').TableEntityResult<SuggestionEntity> | undefined
  let mascotId: string | undefined
  try {
    let found = false
    for await (const entity of suggestionsClient.listEntities<SuggestionEntity>({
      queryOptions: { filter: `RowKey eq '${escapeODataString(suggestionId)}'` },
    })) {
      suggestionEntity = entity
      mascotId = entity.partitionKey as string
      found = true
      break
    }
    if (!found) {
      return { status: 404, jsonBody: { error: 'Suggestion not found' } }
    }
  } catch {
    return { status: 404, jsonBody: { error: 'Suggestion not found' } }
  }

  if (!suggestionEntity || !mascotId) {
    return { status: 404, jsonBody: { error: 'Suggestion not found' } }
  }

  const currentVotes = suggestionEntity.votes ?? 0

  if (revoke) {
    if (!alreadyVoted) {
      return { status: 409, jsonBody: { error: 'No vote to revoke' } }
    }
    // Remove vote record and decrement
    await votesClient.deleteEntity(sessionId, suggestionId)
    const newVotes = Math.max(0, currentVotes - 1)
    await suggestionsClient.updateEntity(
      { partitionKey: mascotId, rowKey: suggestionId, votes: newVotes },
      'Merge',
    )
    const updated = { ...entityToSuggestion(suggestionEntity), votes: newVotes }
    return { status: 200, jsonBody: updated, headers: { 'Content-Type': 'application/json' } }
  } else {
    if (alreadyVoted) {
      return { status: 409, jsonBody: { error: 'Already voted for this suggestion' } }
    }
    // Add vote record and increment
    await votesClient.createEntity({ partitionKey: sessionId, rowKey: suggestionId })
    const newVotes = currentVotes + 1
    await suggestionsClient.updateEntity(
      { partitionKey: mascotId, rowKey: suggestionId, votes: newVotes },
      'Merge',
    )
    const updated = { ...entityToSuggestion(suggestionEntity), votes: newVotes }
    return { status: 200, jsonBody: updated, headers: { 'Content-Type': 'application/json' } }
  }
}

app.http('getVotes', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'votes',
  handler: getVotes,
})

app.http('postVote', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'votes',
  handler: postVote,
})
