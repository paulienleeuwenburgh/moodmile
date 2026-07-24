import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminPage } from './AdminPage'
import type { Campaign, Question, Suggestion } from '../types'

const mockFetchCampaign = vi.fn<(campaignId: string) => Promise<Campaign>>()
const mockFetchQuestions = vi.fn<(campaignId: string) => Promise<Question[]>>()
const mockFetchSuggestions = vi.fn<(campaignId: string) => Promise<Suggestion[]>>()
const mockFetchDeletedSuggestions = vi.fn<
  (adminSecret: string, campaignId: string) => Promise<(Suggestion & { deletedAt?: string; deletedBy?: string; deleteReason?: string })[]>
>()

vi.mock('../api', () => ({
  ApiError: class ApiError extends Error {
    status: number

    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
  fetchCampaign: (...args: Parameters<typeof mockFetchCampaign>) => mockFetchCampaign(...args),
  fetchQuestions: (...args: Parameters<typeof mockFetchQuestions>) => mockFetchQuestions(...args),
  fetchSuggestions: (...args: Parameters<typeof mockFetchSuggestions>) => mockFetchSuggestions(...args),
  fetchDeletedSuggestions: (...args: Parameters<typeof mockFetchDeletedSuggestions>) => mockFetchDeletedSuggestions(...args),
  adminDeleteSuggestion: vi.fn(),
  adminRestoreSuggestion: vi.fn(),
  adminResetVotes: vi.fn(),
  adminResetSuggestions: vi.fn(),
  adminFullReset: vi.fn(),
}))

describe('AdminPage document title', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.title = 'MoodMile'

    mockFetchCampaign.mockResolvedValue({
      id: 'best-padeller-2026',
      title: 'Best Padeller 2026',
      description: 'Vote for the best padeller.',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z',
      allowSuggestions: false,
      maxVotesTotal: 3,
      maxVotesPerCategory: 3,
      maxVotesPerCandidate: 2,
    })
    mockFetchQuestions.mockResolvedValue([
      {
        id: 'nominees',
        campaignId: 'best-padeller-2026',
        title: 'Who do you nominate?',
        description: 'Vote for the best padeller.',
        sortOrder: 1,
      },
    ])
    mockFetchSuggestions.mockResolvedValue([])
    mockFetchDeletedSuggestions.mockResolvedValue([])
  })

  afterEach(() => {
    cleanup()
  })

  it('uses a generic admin title before a campaign is loaded', () => {
    render(<AdminPage />)
    expect(document.title).toBe('MoodMile Admin')
  })

  it('includes the loaded campaign title after authentication', async () => {
    render(<AdminPage />)

    await userEvent.type(screen.getByLabelText(/admin secret/i), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /load campaign/i }))

    await screen.findByText('Admin access granted')
    expect(document.title).toBe('MoodMile Admin | Best Padeller 2026')
  })
})
