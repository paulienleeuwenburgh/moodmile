import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockAppHttp,
  mockEnsureTableExists,
  mockGetCampaign,
  mockListQuestions,
  mockListSuggestions,
  mockListVotes,
  mockListResponses,
} = vi.hoisted(() => ({
  mockAppHttp: vi.fn(),
  mockEnsureTableExists: vi.fn(),
  mockGetCampaign: vi.fn(),
  mockListQuestions: vi.fn(),
  mockListSuggestions: vi.fn(),
  mockListVotes: vi.fn(),
  mockListResponses: vi.fn(),
}))

function toAsyncIterable<T>(items: T[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item
      }
    },
  }
}

vi.mock('@azure/functions', () => ({
  app: {
    http: mockAppHttp,
  },
}))

vi.mock('./tableClient', () => ({
  ensureTableExists: mockEnsureTableExists,
  entityToQuestion: vi.fn((entity) => ({
    id: entity.rowKey,
    campaignId: entity.partitionKey,
    title: entity.title,
    description: entity.description,
    imageUrl: entity.imageUrl,
    sortOrder: entity.sortOrder,
    questionType: entity.questionType,
    allowSuggestions: entity.allowSuggestions,
    allowVoting: entity.allowVoting,
    options: entity.options,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  })),
  entityToSuggestion: vi.fn((entity) => ({
    id: entity.rowKey,
    campaignId: entity.campaignId,
    questionId: entity.questionId,
    name: entity.name,
    createdAt: entity.createdAt,
    votes: entity.votes,
    imageUrl: entity.imageUrl,
  })),
  getQuestionsClient: vi.fn(() => ({
    listEntities: mockListQuestions,
    tableName: 'questions',
  })),
  getSuggestionsClient: vi.fn(() => ({
    listEntities: mockListSuggestions,
    tableName: 'suggestions',
  })),
  getVotesClient: vi.fn(() => ({
    listEntities: mockListVotes,
    tableName: 'votes',
  })),
  getQuestionResponsesClient: vi.fn(() => ({
    listEntities: mockListResponses,
    tableName: 'questionResponses',
  })),
  suggestionPartitionKey: vi.fn((campaignId: string, questionId: string) => `${campaignId}|${questionId}`),
}))

vi.mock('./campaigns', () => ({
  getCampaign: mockGetCampaign,
}))

import { exportCampaignData, getCampaignSummary } from './functions/admin'

describe('admin campaign export', () => {
  beforeEach(() => {
    mockEnsureTableExists.mockReset()
    mockGetCampaign.mockReset()
    mockListQuestions.mockReset()
    mockListSuggestions.mockReset()
    mockListVotes.mockReset()
    mockListResponses.mockReset()
    process.env.ADMIN_SECRET = 'secret'
    mockEnsureTableExists.mockResolvedValue(undefined)
    mockGetCampaign.mockResolvedValue({
      id: 'best-padeller-2026',
      title: 'Best Padeller 2026',
      description: 'Vote for the best padeller.',
      status: 'active',
      maxVotesTotal: 3,
      maxVotesPerCategory: 1,
      maxVotesPerCandidate: 1,
      bannerImageUrl: '/banner.png',
    })
    mockListQuestions.mockReturnValue(
      toAsyncIterable([
        {
          partitionKey: 'best-padeller-2026',
          rowKey: 'q-2',
          title: 'Second category',
          description: 'Second',
          sortOrder: 2,
          questionType: 'text',
          allowSuggestions: true,
          allowVoting: true,
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
        {
          partitionKey: 'best-padeller-2026',
          rowKey: 'q-1',
          title: 'First category',
          description: 'First',
          sortOrder: 1,
          questionType: 'text',
          allowSuggestions: true,
          allowVoting: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    )
    mockListSuggestions.mockReturnValue(
      toAsyncIterable([
        {
          partitionKey: 'best-padeller-2026|q-2',
          rowKey: 's-2',
          campaignId: 'best-padeller-2026',
          questionId: 'q-2',
          sessionId: 'session-b',
          name: 'Casey',
          createdAt: '2026-02-02T00:00:00.000Z',
          votes: 1,
          isDeleted: true,
          deletedAt: '2026-03-01T12:00:00.000Z',
          deletedBy: 'Admin',
          deleteReason: 'Duplicate',
        },
        {
          partitionKey: 'best-padeller-2026|q-1',
          rowKey: 's-1',
          campaignId: 'best-padeller-2026',
          questionId: 'q-1',
          sessionId: 'session-a',
          name: 'Alex',
          createdAt: '2026-02-01T00:00:00.000Z',
          votes: 2,
          isDeleted: false,
        },
      ]),
    )
    mockListVotes.mockReturnValue(
      toAsyncIterable([
        {
          partitionKey: 'best-padeller-2026|session-b',
          rowKey: 's-2',
          questionId: 'q-2',
          suggestionId: 's-2',
          createdAt: '2026-04-02T00:00:00.000Z',
        },
        {
          partitionKey: 'best-padeller-2026|session-a',
          rowKey: 's-1',
          questionId: 'q-1',
          suggestionId: 's-1',
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ]),
    )
    mockListResponses.mockReturnValue(toAsyncIterable([
      {
        partitionKey: 'best-padeller-2026|q-1',
        rowKey: 'session-c',
        questionId: 'q-1',
        answer: '5',
        createdAt: '2026-02-03T00:00:00.000Z',
      },
    ]))
  })

  it('exports campaign metadata, submissions, and votes as a downloadable JSON file', async () => {
    const response = await exportCampaignData(
      {
        params: { campaignId: 'best-padeller-2026' },
        headers: { get: (name: string) => (name.toLowerCase() === 'x-admin-secret' ? 'secret' : null) },
        query: { get: () => 'json' },
      },
      {},
    )

    expect(response.status).toBe(200)
    expect(response.headers['Content-Type']).toBe('application/json; charset=utf-8')
    expect(response.headers['Content-Disposition']).toContain('best-padeller-2026-export-')

    const payload = JSON.parse(String(response.body)) as {
      campaign: { id: string; title: string }
      summary: { uniqueSubmissionDevices: number; uniqueVotingDevices: number }
      questions: Array<{ id: string }>
      submissions: Array<{ id: string; questionTitle: string; isDeleted: boolean; deletedBy?: string; sessionId: string }>
      responses: Array<{ questionId: string; questionType: string; answer: unknown; sessionId: string }>
      votes: Array<{ sessionId: string; suggestionName: string; isDeletedSuggestion: boolean }>
    }

    expect(payload.campaign).toMatchObject({
      id: 'best-padeller-2026',
      title: 'Best Padeller 2026',
    })
    expect(payload.questions.map((question) => question.id)).toEqual(['q-1', 'q-2'])
    expect(payload.summary).toEqual({
      uniqueSubmissionDevices: 3,
      uniqueVotingDevices: 2,
    })
    expect(payload.submissions).toEqual([
      expect.objectContaining({
        id: 's-1',
        questionTitle: 'First category',
        isDeleted: false,
        sessionId: 'session-a',
      }),
      expect.objectContaining({
        id: 's-2',
        questionTitle: 'Second category',
        isDeleted: true,
        deletedBy: 'Admin',
        sessionId: 'session-b',
      }),
    ])
    expect(payload.responses).toEqual([
      expect.objectContaining({ questionId: 'q-1', questionType: 'text', answer: 5, sessionId: 'session-c' }),
    ])
    expect(payload.votes).toEqual([
      expect.objectContaining({
        sessionId: 'session-a',
        suggestionName: 'Alex',
        isDeletedSuggestion: false,
      }),
      expect.objectContaining({
        sessionId: 'session-b',
        suggestionName: 'Casey',
        isDeletedSuggestion: true,
      }),
    ])
  })

  it('exports submissions as csv when requested', async () => {
    const response = await exportCampaignData(
      {
        params: { campaignId: 'best-padeller-2026' },
        headers: { get: (name: string) => (name.toLowerCase() === 'x-admin-secret' ? 'secret' : null) },
        query: { get: (name: string) => (name === 'format' ? 'csv' : null) },
      },
      {},
    )

    expect(response.status).toBe(200)
    expect(response.headers['Content-Type']).toBe('text/csv; charset=utf-8')
    expect(response.headers['Content-Disposition']).toContain('.csv')
    expect(String(response.body)).toContain('campaignId,questionId,questionTitle,submissionId,submissionName,createdAt,votes,submissionDeviceId,isDeleted,deletedAt,deletedBy,deleteReason,imageUrl,submissionType,answer')
    expect(String(response.body)).toContain('best-padeller-2026,q-1,First category,s-1,Alex,2026-02-01T00:00:00.000Z,2,session-a,false,,,,,text suggestion,Alex')
    expect(String(response.body)).toContain('best-padeller-2026,q-2,Second category,s-2,Casey,2026-02-02T00:00:00.000Z,1,session-b,true,2026-03-01T12:00:00.000Z,Admin,Duplicate,,text suggestion,Casey')
    expect(String(response.body)).toContain('best-padeller-2026,q-1,First category,,,2026-02-03T00:00:00.000Z,,session-c,false,,,,,text,5')
  })

  it('returns unique device counts for the admin summary endpoint', async () => {
    const response = await getCampaignSummary(
      {
        params: { campaignId: 'best-padeller-2026' },
        headers: { get: (name: string) => (name.toLowerCase() === 'x-admin-secret' ? 'secret' : null) },
      },
      {},
    )

    expect(response.status).toBe(200)
    expect(response.jsonBody).toEqual({
      uniqueSubmissionDevices: 3,
      uniqueVotingDevices: 2,
    })
  })
})
