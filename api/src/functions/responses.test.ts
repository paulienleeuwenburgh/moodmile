import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAppHttp, mockEnsureTableExists, mockGetQuestionConfig, mockUpsertEntity, mockListEntities } = vi.hoisted(() => ({
  mockAppHttp: vi.fn(),
  mockEnsureTableExists: vi.fn(),
  mockGetQuestionConfig: vi.fn(),
  mockUpsertEntity: vi.fn(),
  mockListEntities: vi.fn(),
}))

vi.mock('@azure/functions', () => ({ app: { http: mockAppHttp } }))
vi.mock('../campaigns', () => ({ getQuestionConfig: mockGetQuestionConfig }))
vi.mock('../tableClient', () => ({
  ensureTableExists: mockEnsureTableExists,
  getQuestionResponsesClient: vi.fn(() => ({
    upsertEntity: mockUpsertEntity,
    listEntities: mockListEntities,
  })),
}))

import '../functions/responses'

const getHandler = mockAppHttp.mock.calls.find(([name]) => name === 'getResponses')?.[1].handler
const postHandler = mockAppHttp.mock.calls.find(([name]) => name === 'postResponse')?.[1].handler

function request(body: unknown) {
  return { json: async () => body, query: { get: () => 'campaign-1' } }
}

describe('typed response API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnsureTableExists.mockResolvedValue(undefined)
    mockUpsertEntity.mockResolvedValue(undefined)
  })

  it('persists a valid structured answer keyed by campaign, question, and session', async () => {
    mockGetQuestionConfig.mockResolvedValue({
      questionType: 'categorical-single',
      options: ['Red', 'Blue'],
      allowSuggestions: false,
    })
    const response = await postHandler(
      request({
        campaignId: 'campaign-1',
        questionId: 'colors',
        sessionId: '00000000-0000-4000-8000-000000000001',
        answer: 'Red',
      }),
      {},
    )

    expect(response.status).toBe(201)
    expect(mockUpsertEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        partitionKey: 'campaign-1|colors',
        rowKey: '00000000-0000-4000-8000-000000000001',
        answer: '"Red"',
      }),
      'Replace',
    )
  })

  it('rejects answers that do not match the question configuration', async () => {
    mockGetQuestionConfig.mockResolvedValue({
      questionType: 'categorical-single',
      options: ['Red', 'Blue'],
      allowSuggestions: false,
    })
    const response = await postHandler(
      request({
        campaignId: 'campaign-1',
        questionId: 'colors',
        sessionId: '00000000-0000-4000-8000-000000000001',
        answer: 'Green',
      }),
      {},
    )

    expect(response.status).toBe(400)
    expect(mockUpsertEntity).not.toHaveBeenCalled()
  })

  it('requires valid session IDs and routes text suggestions to the suggestions API', async () => {
    mockGetQuestionConfig.mockResolvedValue({
      questionType: 'text',
      allowSuggestions: true,
      allowVoting: true,
    })
    const response = await postHandler(
      request({
        campaignId: 'campaign-1',
        questionId: 'name',
        sessionId: '00000000-0000-4000-8000-000000000001',
        answer: 'Rover',
      }),
      {},
    )

    expect(response.status).toBe(403)
    expect(mockUpsertEntity).not.toHaveBeenCalled()
  })

  it('returns aggregated answer counts without exposing session identifiers', async () => {
    mockListEntities.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield { questionId: 'colors', answer: '"Red"' }
        yield { questionId: 'colors', answer: '"Red"' }
        yield { questionId: 'colors', answer: '"Blue"' }
        yield { questionId: 'multiple', answer: '["Red","Blue"]' }
        yield { questionId: 'multiple', answer: '["Blue","Red"]' }
      },
    })
    const response = await getHandler({ query: { get: () => 'campaign-1' } }, {})
    expect(response.jsonBody).toEqual([
      { questionId: 'colors', answer: 'Red', count: 2 },
      { questionId: 'colors', answer: 'Blue', count: 1 },
      { questionId: 'multiple', answer: ['Red', 'Blue'], count: 2 },
    ])
    expect(JSON.stringify(response.jsonBody)).not.toContain('sessionId')
  })
})
