import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  getCampaignsClient,
  getQuestionsClient,
  ensureTableExists,
  entityToCampaignConfig,
  entityToQuestion,
  type CampaignEntity,
  type QuestionEntity,
} from '../tableClient'
import { seedDefaultCampaign } from '../seed'

/**
 * GET /api/campaign
 *
 * Returns the first active campaign from Azure Table Storage.
 * Seeds the default ninja-naming campaign on first request if no active campaign exists.
 */
async function getCampaign(
  _request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const client = getCampaignsClient()
  await ensureTableExists(client)

  for await (const entity of client.listEntities<CampaignEntity>({
    queryOptions: { filter: "PartitionKey eq 'campaign' and status eq 'active'" },
  })) {
    return {
      status: 200,
      jsonBody: entityToCampaignConfig(entity),
      headers: { 'Content-Type': 'application/json' },
    }
  }

  // No active campaign found — seed the default and return it.
  await seedDefaultCampaign()
  const seeded = await client.getEntity<CampaignEntity>('campaign', 'ninja-naming')
  return {
    status: 200,
    jsonBody: entityToCampaignConfig(seeded),
    headers: { 'Content-Type': 'application/json' },
  }
}

/**
 * GET /api/questions?campaignId=X
 *
 * Returns all questions for the given campaign, ordered by sortOrder.
 */
async function getQuestions(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const campaignId = request.query.get('campaignId')
  if (!campaignId) {
    return { status: 400, jsonBody: { error: 'campaignId query parameter is required' } }
  }

  const client = getQuestionsClient()
  await ensureTableExists(client)

  const questions = []
  for await (const entity of client.listEntities<QuestionEntity>({
    queryOptions: { filter: `PartitionKey eq '${campaignId.replace(/'/g, "''")}'` },
  })) {
    questions.push(entityToQuestion(entity))
  }

  questions.sort((a, b) => a.sortOrder - b.sortOrder)

  return {
    status: 200,
    jsonBody: questions,
    headers: { 'Content-Type': 'application/json' },
  }
}

app.http('getCampaign', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'campaign',
  handler: getCampaign,
})

app.http('getQuestions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'questions',
  handler: getQuestions,
})
