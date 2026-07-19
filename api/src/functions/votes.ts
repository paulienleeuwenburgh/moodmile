import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { RestError, type TableEntityResult } from '@azure/data-tables'
import {
  ensureTableExists,
  entityToSuggestion,
  getSuggestionsClient,
  getVotesClient,
  SuggestionEntity,
  VoteEntity,
  suggestionPartitionKey,
  votePartitionKey,
} from '../tableClient'
import { escapeODataString } from '../odata'
import { getCampaign } from '../campaigns'

async function getVotes(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const sessionId = request.query.get('sessionId')
  const campaignId = request.query.get('campaignId')

  if (!sessionId || !campaignId) {
    return { status: 400, jsonBody: { error: 'campaignId and sessionId query parameters are required' } }
  }

  const client = getVotesClient()
  await ensureTableExists(client)
  const votedIds: string[] = []
  const partKey = votePartitionKey(campaignId, sessionId)
  for await (const entity of client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${escapeODataString(partKey)}'` },
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
  const body = (await request.json()) as {
    campaignId?: string
    questionId?: string
    sessionId?: string
    suggestionId?: string
    revoke?: boolean
  }
  const { campaignId, questionId, sessionId, suggestionId, revoke } = body

  if (!campaignId || !questionId || !sessionId || !suggestionId) {
    return {
      status: 400,
      jsonBody: { error: 'campaignId, questionId, sessionId and suggestionId are required' },
    }
  }

  const campaign = getCampaign(campaignId)
  if (!campaign) {
    return { status: 404, jsonBody: { error: 'Campaign not found' } }
  }

  const votesClient = getVotesClient()
  const suggestionsClient = getSuggestionsClient()
  await Promise.all([ensureTableExists(votesClient), ensureTableExists(suggestionsClient)])
  const votePartKey = votePartitionKey(campaignId, sessionId)
  const suggestionPartKey = suggestionPartitionKey(campaignId, questionId)

  // Check current vote state for this suggestion
  let alreadyVoted = false
  try {
    await votesClient.getEntity(votePartKey, suggestionId)
    alreadyVoted = true
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) {
      alreadyVoted = false
    } else {
      throw err
    }
  }

  // Fetch suggestion entity
  let suggestionEntity: TableEntityResult<SuggestionEntity> | undefined
  try {
    let found = false
    for await (const entity of suggestionsClient.listEntities<SuggestionEntity>({
      queryOptions: {
        filter: `PartitionKey eq '${escapeODataString(suggestionPartKey)}' and RowKey eq '${escapeODataString(suggestionId)}'`,
      },
    })) {
      suggestionEntity = entity
      found = true
      break
    }
    if (!found) {
      return { status: 404, jsonBody: { error: 'Suggestion not found' } }
    }
  } catch {
    return { status: 404, jsonBody: { error: 'Suggestion not found' } }
  }

  if (!suggestionEntity) {
    return { status: 404, jsonBody: { error: 'Suggestion not found' } }
  }

  const currentVotes = suggestionEntity.votes ?? 0

  if (revoke) {
    if (!alreadyVoted) {
      return { status: 409, jsonBody: { error: 'No vote to revoke' } }
    }
    await votesClient.deleteEntity(votePartKey, suggestionId)
    const newVotes = Math.max(0, currentVotes - 1)
    await suggestionsClient.updateEntity(
      { partitionKey: suggestionPartKey, rowKey: suggestionId, votes: newVotes },
      'Merge',
    )
    const updated = { ...entityToSuggestion(suggestionEntity), votes: newVotes }
    return { status: 200, jsonBody: updated, headers: { 'Content-Type': 'application/json' } }
  }

  // Adding a vote — check campaign rules
  if (!campaign.allowMultipleVotesPerSuggestion && alreadyVoted) {
    return { status: 409, jsonBody: { error: 'Already voted for this suggestion' } }
  }

  // Enforce maxVotesPerUser: count all votes cast by this session in this campaign
  if (campaign.maxVotesPerUser > 0) {
    let totalVotes = 0
    for await (const _entity of votesClient.listEntities<VoteEntity>({
      queryOptions: { filter: `PartitionKey eq '${escapeODataString(votePartKey)}'` },
    })) {
      totalVotes++
    }
    if (totalVotes >= campaign.maxVotesPerUser) {
      return {
        status: 409,
        jsonBody: { error: `You have reached the maximum of ${campaign.maxVotesPerUser} votes for this campaign` },
      }
    }
  }

  const createdAt = new Date().toISOString()
  if (alreadyVoted) {
    // allowMultipleVotesPerSuggestion = true: store a new vote entry with unique rowKey
    const voteRowKey = `${suggestionId}|${crypto.randomUUID()}`
    await votesClient.createEntity({
      partitionKey: votePartKey,
      rowKey: voteRowKey,
      questionId,
      createdAt,
    })
  } else {
    // Standard: rowKey = suggestionId (one entry per suggestion)
    await votesClient.createEntity({
      partitionKey: votePartKey,
      rowKey: suggestionId,
      questionId,
      createdAt,
    })
  }

  const newVotes = currentVotes + 1
  await suggestionsClient.updateEntity(
    { partitionKey: suggestionPartKey, rowKey: suggestionId, votes: newVotes },
    'Merge',
  )
  const updated = { ...entityToSuggestion(suggestionEntity), votes: newVotes }
  return { status: 200, jsonBody: updated, headers: { 'Content-Type': 'application/json' } }
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
