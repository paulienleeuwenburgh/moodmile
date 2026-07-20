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
 * GET /api/campaign?campaignId=X
 *
 * Returns the campaign with the given campaignId from Azure Table Storage.
 * Seeds the default ninja-naming campaign on first request if it does not exist yet.
 * Returns 404 if the requested campaign is not found.
 */
async function getCampaign(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const campaignId = request.query.get('campaignId')
  if (!campaignId) {
    return { status: 400, jsonBody: { error: 'campaignId query parameter is required' } }
  }

  // Seed the default campaign on first request so the ninja campaign always exists.
  await seedDefaultCampaign()

  const client = getCampaignsClient()
  await ensureTableExists(client)

  try {
    const entity = await client.getEntity<CampaignEntity>('campaign', campaignId)
    return {
      status: 200,
      jsonBody: entityToCampaignConfig(entity),
      headers: { 'Content-Type': 'application/json' },
    }
  } catch (err) {
    const isNotFound =
      err instanceof Error &&
      'statusCode' in err &&
      (err as { statusCode: number }).statusCode === 404
    if (isNotFound) {
      return { status: 404, jsonBody: { error: 'Campaign not found' } }
    }
    throw err
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
