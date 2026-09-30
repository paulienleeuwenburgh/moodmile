import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAppHttp, mockEnsureTableExists, mockGetQuestionConfig, mockListEntities, mockEntityToSuggestion } = vi.hoisted(() => ({
  mockAppHttp: vi.fn(),
  mockEnsureTableExists: vi.fn(),
  mockGetQuestionConfig: vi.fn(),
  mockListEntities: vi.fn(),
  mockEntityToSuggestion: vi.fn((entity: { rowKey: string; name: string }) => ({ id: entity.rowKey, name: entity.name })),
}))

vi.mock('@azure/functions', () => ({ app: { http: mockAppHttp } }))
vi.mock('../campaigns', () => ({ getQuestionConfig: mockGetQuestionConfig }))
vi.mock('../suggestionValidation', () => ({ validateSuggestion: vi.fn() }))
vi.mock('../tableClient', () => ({
  ensureTableExists: mockEnsureTableExists,
  entityToSuggestion: mockEntityToSuggestion,
  getSuggestionsClient: vi.fn(() => ({
    listEntities: mockListEntities,
  })),
  suggestionPartitionKey: (campaignId: string, questionId: string) => `${campaignId}|${questionId}`,
}))

import '../functions/suggestions'

const getSuggestionsHandler = mockAppHttp.mock.calls.find(([name]) => name === 'getSuggestions')?.[1].handler

function request(campaignId: string, sessionId?: string) {
  const params = new Map<string, string>([['campaignId', campaignId]])
  if (sessionId !== undefined) params.set('sessionId', sessionId)
  return { query: { get: (key: string) => params.get(key) ?? null } }
}

function suggestionRows(entities: Array<{ rowKey: string; name: string; questionId: string; campaignId: string; sessionId?: string }>) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const entity of entities) {
        yield entity
      }
    },
  }
}

describe('getSuggestions visibility filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnsureTableExists.mockResolvedValue(undefined)
    mockEntityToSuggestion.mockImplementation((entity: { rowKey: string; name: string }) => ({ id: entity.rowKey, name: entity.name }))
  })

  it('hides other users submissions when displaySubmissions=false and voting is disabled', async () => {
    mockListEntities.mockReturnValue(suggestionRows([
      { rowKey: 's1', name: 'Mine', questionId: 'q1', campaignId: 'c1', sessionId: 'my-session' },
      { rowKey: 's2', name: 'Theirs', questionId: 'q1', campaignId: 'c1', sessionId: 'other-session' },
    ]))
    mockGetQuestionConfig.mockResolvedValue({
      questionType: 'text',
      displaySubmissions: false,
      numberOfVotes: 0,
    })

    const response = await getSuggestionsHandler(request('c1', 'my-session'), {})

    expect(response.jsonBody).toEqual([{ id: 's1', name: 'Mine' }])
  })

  it('shows all submissions when displaySubmissions is unset (default true)', async () => {
    mockListEntities.mockReturnValue(suggestionRows([
      { rowKey: 's1', name: 'Mine', questionId: 'q1', campaignId: 'c1', sessionId: 'my-session' },
      { rowKey: 's2', name: 'Theirs', questionId: 'q1', campaignId: 'c1', sessionId: 'other-session' },
    ]))
    mockGetQuestionConfig.mockResolvedValue({ questionType: 'text', numberOfVotes: 0 })

    const response = await getSuggestionsHandler(request('c1', 'my-session'), {})

    expect(response.jsonBody).toEqual([{ id: 's1', name: 'Mine' }, { id: 's2', name: 'Theirs' }])
  })

  it('overrules displaySubmissions=false to show everyone when voting is enabled', async () => {
    mockListEntities.mockReturnValue(suggestionRows([
      { rowKey: 's1', name: 'Mine', questionId: 'q1', campaignId: 'c1', sessionId: 'my-session' },
      { rowKey: 's2', name: 'Theirs', questionId: 'q1', campaignId: 'c1', sessionId: 'other-session' },
    ]))
    mockGetQuestionConfig.mockResolvedValue({
      questionType: 'text',
      displaySubmissions: false,
      numberOfVotes: 1,
    })

    const response = await getSuggestionsHandler(request('c1', 'my-session'), {})

    expect(response.jsonBody).toEqual([{ id: 's1', name: 'Mine' }, { id: 's2', name: 'Theirs' }])
  })

  it('never matches suggestions by sessionId when no sessionId is supplied on the request', async () => {
    mockListEntities.mockReturnValue(suggestionRows([
      { rowKey: 's1', name: 'Orphaned', questionId: 'q1', campaignId: 'c1' },
    ]))
    mockGetQuestionConfig.mockResolvedValue({
      questionType: 'text',
      displaySubmissions: false,
      numberOfVotes: 0,
    })

    const response = await getSuggestionsHandler(request('c1'), {})

    expect(response.jsonBody).toEqual([])
  })

  it('does not fail the whole request when a question fails validation, and logs a warning', async () => {
    mockListEntities.mockReturnValue(suggestionRows([
      { rowKey: 's1', name: 'Mine', questionId: 'broken-question', campaignId: 'c1', sessionId: 'my-session' },
    ]))
    mockGetQuestionConfig.mockRejectedValue(new Error('Invalid question configuration'))
    const warn = vi.fn()

    const response = await getSuggestionsHandler(request('c1', 'my-session'), { warn })

    expect(response.status).toBe(200)
    expect(response.jsonBody).toEqual([{ id: 's1', name: 'Mine' }])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('broken-question'))
  })
})
