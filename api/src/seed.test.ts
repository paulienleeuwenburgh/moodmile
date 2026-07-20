import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RestError } from '@azure/data-tables'

// ---------------------------------------------------------------------------
// Hoist mock functions so they are available when vi.mock factory is called
// ---------------------------------------------------------------------------

const { mockGetEntity, mockUpsertEntity, mockCampaignEnsure, mockQuestionsUpsert } = vi.hoisted(() => ({
  mockGetEntity: vi.fn(),
  mockUpsertEntity: vi.fn(),
  mockCampaignEnsure: vi.fn(),
  mockQuestionsUpsert: vi.fn(),
}))

vi.mock('./tableClient', () => ({
  getCampaignsClient: vi.fn(() => ({
    getEntity: mockGetEntity,
    upsertEntity: mockUpsertEntity,
    tableName: 'campaigns',
  })),
  getQuestionsClient: vi.fn(() => ({
    upsertEntity: mockQuestionsUpsert,
    tableName: 'questions',
  })),
  ensureTableExists: mockCampaignEnsure,
}))

import { seedDefaultCampaign } from './seed'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('seedDefaultCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCampaignEnsure.mockResolvedValue(undefined)
    mockUpsertEntity.mockResolvedValue(undefined)
    mockQuestionsUpsert.mockResolvedValue(undefined)
  })

  it('creates ninja campaign and all four questions when they do not exist', async () => {
    // Simulate 404: campaign not found
    mockGetEntity.mockRejectedValue(new RestError('Not Found', { statusCode: 404 }))

    await seedDefaultCampaign()

    expect(mockUpsertEntity).toHaveBeenCalledOnce()
    const [campaignArg, mode] = mockUpsertEntity.mock.calls[0]
    expect(campaignArg.rowKey).toBe('ninja-naming')
    expect(campaignArg.title).toBe('These four ninjas need names')
    expect(campaignArg.maxVotesTotal).toBe(4)
    expect(mode).toBe('Replace')

    expect(mockQuestionsUpsert).toHaveBeenCalledTimes(4)
    const questionIds = mockQuestionsUpsert.mock.calls.map((args: unknown[]) => (args[0] as { rowKey: string }).rowKey)
    expect(questionIds).toContain('ninja-1')
    expect(questionIds).toContain('ninja-2')
    expect(questionIds).toContain('ninja-3')
    expect(questionIds).toContain('ninja-4')
  })

  it('skips creation when ninja campaign already exists', async () => {
    // Simulate successful getEntity (campaign exists)
    mockGetEntity.mockResolvedValue({
      partitionKey: 'campaign',
      rowKey: 'ninja-naming',
      title: 'These four ninjas need names',
    })

    await seedDefaultCampaign()

    expect(mockUpsertEntity).not.toHaveBeenCalled()
    expect(mockQuestionsUpsert).not.toHaveBeenCalled()
  })

  it('seeds correct campaign properties', async () => {
    mockGetEntity.mockRejectedValue(new RestError('Not Found', { statusCode: 404 }))

    await seedDefaultCampaign()

    const [campaignEntity] = mockUpsertEntity.mock.calls[0]
    expect(campaignEntity.partitionKey).toBe('campaign')
    expect(campaignEntity.status).toBe('active')
    expect(campaignEntity.allowSuggestions).toBe(true)
    expect(campaignEntity.maxVotesPerCategory).toBe(1)
    expect(campaignEntity.maxVotesPerCandidate).toBe(1)
  })

  it('seeds questions with correct image URLs', async () => {
    mockGetEntity.mockRejectedValue(new RestError('Not Found', { statusCode: 404 }))

    await seedDefaultCampaign()

    const imageUrls = mockQuestionsUpsert.mock.calls.map((args: unknown[]) => (args[0] as { imageUrl: string }).imageUrl)
    expect(imageUrls).toContain('/mascots/ninja1.png')
    expect(imageUrls).toContain('/mascots/ninja2.png')
    expect(imageUrls).toContain('/mascots/ninja3.png')
    expect(imageUrls).toContain('/mascots/ninja4.png')
  })
})
