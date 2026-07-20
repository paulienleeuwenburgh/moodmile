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
import { canCastVote, type VoteRecord } from '../voteLimits'

interface StoredVoteRecord extends VoteRecord {
  partitionKey: string
  rowKey: string
}

function getSuggestionId(entity: VoteEntity): string {
  return (entity.suggestionId as string | undefined) ?? String(entity.rowKey).split('|')[0] ?? ''
}

async function listVoteRecords(campaignId: string, sessionId: string): Promise<StoredVoteRecord[]> {
  const client = getVotesClient()
  const partKey = votePartitionKey(campaignId, sessionId)
  const records: StoredVoteRecord[] = []

  for await (const entity of client.listEntities<VoteEntity>({
    queryOptions: { filter: `PartitionKey eq '${escapeODataString(partKey)}'` },
  })) {
    records.push({
      partitionKey: entity.partitionKey as string,
      rowKey: entity.rowKey as string,
      questionId: String(entity.questionId ?? ''),
      suggestionId: getSuggestionId(entity),
    })
  }

  return records
}

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
  const seen = new Set<string>()
  const voteRecords = await listVoteRecords(campaignId, sessionId)
  for (const vote of voteRecords) {
    if (vote.suggestionId && !seen.has(vote.suggestionId)) {
      seen.add(vote.suggestionId)
      votedIds.push(vote.suggestionId)
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

  const voteRecords = await listVoteRecords(campaignId, sessionId)
  const existingVote = voteRecords.find((vote) => vote.suggestionId === suggestionId)
  const alreadyVoted = Boolean(existingVote)

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

    if (!existingVote) {
      return { status: 409, jsonBody: { error: 'No vote to revoke' } }
    }

    await votesClient.deleteEntity(existingVote.partitionKey, existingVote.rowKey)
    const newVotes = Math.max(0, currentVotes - 1)
    await suggestionsClient.updateEntity(
      { partitionKey: suggestionPartKey, rowKey: suggestionId, votes: newVotes },
      'Merge',
    )
    const updated = { ...entityToSuggestion(suggestionEntity), votes: newVotes }
    return { status: 200, jsonBody: updated, headers: { 'Content-Type': 'application/json' } }
  }

  const voteCheck = canCastVote(campaign, voteRecords, questionId, suggestionId)
  if (!voteCheck.allowed) {
    return {
      status: 409,
      jsonBody: { error: voteCheck.error },
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
