import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { type TableEntityResult } from '@azure/data-tables'
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

  // Return unique suggestion IDs (supports both legacy rowKey=suggestionId and
  // multi-vote rowKey="{suggestionId}|{uuid}" entries via the explicit suggestionId field).
  const seen = new Set<string>()
  for await (const entity of client.listEntities<VoteEntity>({
    queryOptions: { filter: `PartitionKey eq '${escapeODataString(partKey)}'` },
  })) {
    const sid = (entity.suggestionId as string | undefined) ?? (entity.rowKey as string)
    if (sid && !seen.has(sid)) {
      seen.add(sid)
      votedIds.push(sid)
    }
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

  // Count how many times this user has already voted for this specific suggestion.
  let candidateVoteCount = 0
  for await (const _entity of votesClient.listEntities<VoteEntity>({
    queryOptions: {
      filter: `PartitionKey eq '${escapeODataString(votePartKey)}' and suggestionId eq '${escapeODataString(suggestionId)}'`,
    },
  })) {
    candidateVoteCount++
  }
  const alreadyVoted = candidateVoteCount > 0

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

    // Delete one vote entity for this candidate (the first match found).
    let revokePartKey: string | undefined
    let revokeRowKey: string | undefined
    for await (const entity of votesClient.listEntities<VoteEntity>({
      queryOptions: {
        filter: `PartitionKey eq '${escapeODataString(votePartKey)}' and suggestionId eq '${escapeODataString(suggestionId)}'`,
      },
    })) {
      revokePartKey = entity.partitionKey as string
      revokeRowKey = entity.rowKey as string
      break
    }

    if (!revokePartKey || !revokeRowKey) {
      return { status: 409, jsonBody: { error: 'No vote to revoke' } }
    }

    await votesClient.deleteEntity(revokePartKey, revokeRowKey)
    const newVotes = Math.max(0, currentVotes - 1)
    await suggestionsClient.updateEntity(
      { partitionKey: suggestionPartKey, rowKey: suggestionId, votes: newVotes },
      'Merge',
    )
    const updated = { ...entityToSuggestion(suggestionEntity), votes: newVotes }
    return { status: 200, jsonBody: updated, headers: { 'Content-Type': 'application/json' } }
  }

  // -----------------------------------------------------------------------
  // Adding a vote — enforce campaign voting rules
  // -----------------------------------------------------------------------

  // Rule 1: maxVotesPerCandidate — limit votes per suggestion
  if (campaign.maxVotesPerCandidate > 0 && candidateVoteCount >= campaign.maxVotesPerCandidate) {
    return {
      status: 409,
      jsonBody: { error: `You have already cast the maximum of ${campaign.maxVotesPerCandidate} vote(s) for this candidate` },
    }
  }

  // Rule 2: maxVotesPerCategory — limit votes within a question
  if (campaign.maxVotesPerCategory > 0) {
    let categoryVoteCount = 0
    for await (const _entity of votesClient.listEntities<VoteEntity>({
      queryOptions: {
        filter: `PartitionKey eq '${escapeODataString(votePartKey)}' and questionId eq '${escapeODataString(questionId)}'`,
      },
    })) {
      categoryVoteCount++
    }
    if (categoryVoteCount >= campaign.maxVotesPerCategory) {
      return {
        status: 409,
        jsonBody: { error: `You have reached the maximum of ${campaign.maxVotesPerCategory} vote(s) for this category` },
      }
    }
  }

  // Rule 3: maxVotesTotal — limit total votes across the campaign
  if (campaign.maxVotesTotal > 0) {
    let totalVoteCount = 0
    for await (const _entity of votesClient.listEntities<VoteEntity>({
      queryOptions: { filter: `PartitionKey eq '${escapeODataString(votePartKey)}'` },
    })) {
      totalVoteCount++
    }
    if (totalVoteCount >= campaign.maxVotesTotal) {
      return {
        status: 409,
        jsonBody: { error: `You have reached the maximum of ${campaign.maxVotesTotal} total vote(s) for this campaign` },
      }
    }
  }

  // Persist the vote.
  // Use rowKey = suggestionId for single-vote-per-candidate campaigns, a unique
  // key otherwise so multiple votes for the same candidate don't collide.
  const voteRowKey =
    campaign.maxVotesPerCandidate === 1
      ? suggestionId
      : `${suggestionId}|${crypto.randomUUID()}`
  const createdAt = new Date().toISOString()

  await votesClient.createEntity({
    partitionKey: votePartKey,
    rowKey: voteRowKey,
    questionId,
    suggestionId,
    createdAt,
  })

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
