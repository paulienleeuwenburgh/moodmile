import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminPage } from './AdminPage'
import type { AdminCampaignSummary, Campaign, ExportFormat, Question, Suggestion } from '../types'

const mockFetchCampaign = vi.fn<(campaignId: string) => Promise<Campaign>>()
const mockFetchQuestions = vi.fn<(campaignId: string) => Promise<Question[]>>()
const mockFetchSuggestions = vi.fn<(campaignId: string) => Promise<Suggestion[]>>()
const mockFetchDeletedSuggestions = vi.fn<
  (adminSecret: string, campaignId: string) => Promise<(Suggestion & { deletedAt?: string; deletedBy?: string; deleteReason?: string })[]>
>()
const mockFetchAdminCampaignSummary = vi.fn<(adminSecret: string, campaignId: string) => Promise<AdminCampaignSummary>>()
const mockAdminDownloadCampaignExport = vi.fn<
  (adminSecret: string, campaignId: string, format: ExportFormat) => Promise<{ blob: Blob; fileName: string }>
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
  fetchAdminCampaignSummary: (...args: Parameters<typeof mockFetchAdminCampaignSummary>) => mockFetchAdminCampaignSummary(...args),
  adminDownloadCampaignExport: (...args: Parameters<typeof mockAdminDownloadCampaignExport>) => mockAdminDownloadCampaignExport(...args),
  adminDeleteSuggestion: vi.fn(),
  adminRestoreSuggestion: vi.fn(),
  adminResetVotes: vi.fn(),
  adminResetSuggestions: vi.fn(),
  adminFullReset: vi.fn(),
}))

async function createApiError(status: number, message: string) {
  const { ApiError } = await import('../api')
  return new ApiError(status, message)
}

describe('AdminPage document title', () => {
  const createObjectUrl = vi.fn(() => 'blob:download')
  const revokeObjectUrl = vi.fn()
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  beforeEach(() => {
    vi.clearAllMocks()
    document.title = 'MoodMile'
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectUrl })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectUrl })

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
    mockFetchAdminCampaignSummary.mockResolvedValue({
      uniqueSubmissionDevices: 2,
      uniqueVotingDevices: 3,
    })
    mockAdminDownloadCampaignExport.mockResolvedValue({
      blob: new Blob(['{}'], { type: 'application/json' }),
      fileName: 'ninja-naming-export-2026-09-28.json',
    })
  })

  afterEach(() => {
    cleanup()
  })

  afterAll(() => {
    clickSpy.mockRestore()
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
    expect(screen.getByText('Unique submission devices')).toBeInTheDocument()
    expect(screen.getByText('Unique voting devices')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows the invalid secret message for a 401 API error', async () => {
    mockFetchCampaign.mockRejectedValueOnce(await createApiError(401, 'Unauthorized'))

    render(<AdminPage />)

    await userEvent.type(screen.getByLabelText(/admin secret/i), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /load campaign/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid admin secret. Please check your credentials and try again.',
    )
  })

  it('shows the server error message for a 500 API error', async () => {
    mockFetchCampaign.mockRejectedValueOnce(await createApiError(500, 'HTTP 500'))

    render(<AdminPage />)

    await userEvent.type(screen.getByLabelText(/admin secret/i), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /load campaign/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unexpected server error. Please try again later.',
    )
  })

  it('downloads a campaign export from the admin portal', async () => {
    const user = userEvent.setup()
    render(<AdminPage />)

    await user.type(screen.getByLabelText(/admin secret/i), 'secret')
    await user.click(screen.getByRole('button', { name: /load campaign/i }))
    await screen.findByText('Admin access granted')

    await user.click(screen.getByRole('button', { name: /download export/i }))

    expect(mockAdminDownloadCampaignExport).toHaveBeenCalledWith('secret', 'ninja-naming', 'json')
    expect(createObjectUrl).toHaveBeenCalledOnce()
    expect(clickSpy).toHaveBeenCalledOnce()
    await waitFor(() => expect(revokeObjectUrl).toHaveBeenCalledWith('blob:download'))
    expect(await screen.findByRole('status')).toHaveTextContent('Export download started for "Best Padeller 2026" as JSON.')
  })

  it('downloads a csv campaign export from the admin portal', async () => {
    const user = userEvent.setup()
    mockAdminDownloadCampaignExport.mockResolvedValueOnce({
      blob: new Blob(['id,name'], { type: 'text/csv' }),
      fileName: 'ninja-naming-export-2026-09-28.csv',
    })
    render(<AdminPage />)

    await user.type(screen.getByLabelText(/admin secret/i), 'secret')
    await user.click(screen.getByRole('button', { name: /load campaign/i }))
    await screen.findByText('Admin access granted')

    await user.click(screen.getByRole('radio', { name: 'CSV' }))
    await user.click(screen.getByRole('button', { name: /download export/i }))

    expect(mockAdminDownloadCampaignExport).toHaveBeenCalledWith('secret', 'ninja-naming', 'csv')
  })
})
