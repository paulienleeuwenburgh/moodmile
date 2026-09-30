import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAppHttp, mockEnsureTableExists, mockGetQuestionConfig, mockListEntities, mockSeedDefaultCampaign } = vi.hoisted(() => ({
  mockAppHttp: vi.fn(),
  mockEnsureTableExists: vi.fn(),
  mockGetQuestionConfig: vi.fn(),
  mockListEntities: vi.fn(),
  mockSeedDefaultCampaign: vi.fn(),
}))

vi.mock('@azure/functions', () => ({ app: { http: mockAppHttp } }))
vi.mock('../campaigns', () => ({ getQuestionConfig: mockGetQuestionConfig }))
vi.mock('../seed', () => ({ seedDefaultCampaign: mockSeedDefaultCampaign }))
vi.mock('../tableClient', () => ({
  ensureTableExists: mockEnsureTableExists,
  getCampaignsClient: vi.fn(() => ({})),
  getQuestionsClient: vi.fn(() => ({
    listEntities: mockListEntities,
  })),
  entityToCampaignConfig: vi.fn(),
}))

import '../functions/campaigns'

const getQuestionsHandler = mockAppHttp.mock.calls.find(([name]) => name === 'getQuestions')?.[1].handler

function request(campaignId: string) {
  return { query: { get: () => campaignId } }
}

function questionRows(ids: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const id of ids) {
        yield { rowKey: id }
      }
    },
  }
}

describe('getQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnsureTableExists.mockResolvedValue(undefined)
  })

  it('skips an individual question that fails validation instead of failing the whole request', async () => {
    mockListEntities.mockReturnValue(questionRows(['good-question', 'broken-question']))
    mockGetQuestionConfig.mockImplementation(async (_campaignId: string, questionId: string) => {
      if (questionId === 'broken-question') {
        throw new Error('Invalid question configuration for "broken-question": This question type requires at least two non-empty options.')
      }
      return { id: questionId, sortOrder: 1 }
    })

    const response = await getQuestionsHandler(request('campaign-1'), { warn: vi.fn() })

    expect(response.status).toBe(200)
    expect(response.jsonBody).toEqual([{ id: 'good-question', sortOrder: 1 }])
  })

  it('returns all questions when every one is valid', async () => {
    mockListEntities.mockReturnValue(questionRows(['q1', 'q2']))
    mockGetQuestionConfig.mockImplementation(async (_campaignId: string, questionId: string) =>
      ({ id: questionId, sortOrder: questionId === 'q1' ? 1 : 2 }),
    )

    const response = await getQuestionsHandler(request('campaign-1'), { warn: vi.fn() })

    expect(response.status).toBe(200)
    expect(response.jsonBody).toEqual([
      { id: 'q1', sortOrder: 1 },
      { id: 'q2', sortOrder: 2 },
    ])
  })

  it('logs a warning identifying the skipped question', async () => {
    mockListEntities.mockReturnValue(questionRows(['broken-question']))
    mockGetQuestionConfig.mockRejectedValue(new Error('boom'))
    const warn = vi.fn()

    await getQuestionsHandler(request('campaign-1'), { warn })

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('broken-question'))
  })
})
