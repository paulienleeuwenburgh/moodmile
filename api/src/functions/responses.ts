import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { ensureTableExists, getQuestionResponsesClient, type QuestionResponseEntity } from '../tableClient'
import { escapeODataString } from '../odata'
import { getQuestionConfig } from '../campaigns'
import { validateResponse, type ResponseAnswer } from '../responseValidation'

function responsePartitionKey(campaignId: string, questionId: string): string {
  return `${campaignId}|${questionId}`
}

async function getResponses(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const campaignId = request.query.get('campaignId')
  if (!campaignId) {
    return { status: 400, jsonBody: { error: 'campaignId query parameter is required' } }
  }

  const client = getQuestionResponsesClient()
  await ensureTableExists(client)
  const filter = `PartitionKey ge '${escapeODataString(campaignId)}|' and PartitionKey lt '${escapeODataString(campaignId)}~'`
  const grouped = new Map<string, { questionId: string; answer: ResponseAnswer; count: number }>()
  for await (const entity of client.listEntities<QuestionResponseEntity>({ queryOptions: { filter } })) {
    let answer: ResponseAnswer
    try {
      answer = JSON.parse(entity.answer) as ResponseAnswer
    } catch {
      continue
    }
    const aggregateAnswer = Array.isArray(answer) ? [...answer].sort() : answer
    const key = JSON.stringify([entity.questionId, aggregateAnswer])
    const existing = grouped.get(key)
    if (existing) {
      existing.count += 1
    } else {
      grouped.set(key, { questionId: entity.questionId, answer, count: 1 })
    }
  }

  return {
    status: 200,
    jsonBody: [...grouped.values()],
    headers: { 'Content-Type': 'application/json' },
  }
}

async function postResponse(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = (await request.json()) as {
    campaignId?: string
    questionId?: string
    sessionId?: string
    answer?: unknown
  }
  const campaignId = body.campaignId?.trim()
  const questionId = body.questionId?.trim()
  const sessionId = body.sessionId?.trim()
  if (!campaignId || !questionId || !sessionId || body.answer === undefined) {
    return { status: 400, jsonBody: { error: 'campaignId, questionId, sessionId and answer are required' } }
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    return { status: 400, jsonBody: { error: 'sessionId must be a valid UUID' } }
  }

  const question = await getQuestionConfig(campaignId, questionId)
  if (!question) {
    return { status: 404, jsonBody: { error: 'Question not found' } }
  }
  if (question.questionType === 'text') {
    return { status: 403, jsonBody: { error: 'Text answers must be submitted as suggestions' } }
  }

  const validationError = validateResponse(question, body.answer)
  if (validationError) {
    return { status: 400, jsonBody: { error: validationError } }
  }

  const client = getQuestionResponsesClient()
  await ensureTableExists(client)
  await client.upsertEntity(
    {
      partitionKey: responsePartitionKey(campaignId, questionId),
      rowKey: sessionId,
      campaignId,
      questionId,
      answer: JSON.stringify(body.answer),
      createdAt: new Date().toISOString(),
    },
    'Replace',
  )
  return { status: 201, jsonBody: { success: true } }
}

app.http('getResponses', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'responses',
  handler: getResponses,
})

app.http('postResponse', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'responses',
  handler: postResponse,
})
