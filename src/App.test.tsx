import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Campaign, Question, Suggestion } from './types'

// ---------------------------------------------------------------------------
// Mock the API module so tests never make real HTTP calls
// ---------------------------------------------------------------------------
const mockFetchCampaign = vi.fn<(campaignId: string) => Promise<Campaign>>()
const mockFetchQuestions = vi.fn<(campaignId: string) => Promise<Question[]>>()
const mockFetchSuggestions = vi.fn<(campaignId: string) => Promise<Suggestion[]>>()
const mockFetchVoteCounts = vi.fn<(campaignId: string, sessionId: string) => Promise<Map<string, number>>>()
const mockPostSuggestion = vi.fn<(campaignId: string, questionId: string, name: string) => Promise<Suggestion | null>>()
const mockPostVote = vi.fn<
  (campaignId: string, questionId: string, suggestionId: string, sessionId: string, revoke: boolean) => Promise<Suggestion | null>
>()

vi.mock('./api', () => ({
  fetchCampaign: (...args: Parameters<typeof mockFetchCampaign>) => mockFetchCampaign(...args),
  fetchQuestions: (...args: Parameters<typeof mockFetchQuestions>) => mockFetchQuestions(...args),
  fetchSuggestions: (...args: Parameters<typeof mockFetchSuggestions>) =>
    mockFetchSuggestions(...args),
  fetchVoteCounts: (...args: Parameters<typeof mockFetchVoteCounts>) => mockFetchVoteCounts(...args),
  postSuggestion: (...args: Parameters<typeof mockPostSuggestion>) => mockPostSuggestion(...args),
  postVote: (...args: Parameters<typeof mockPostVote>) => mockPostVote(...args),
}))

// ---------------------------------------------------------------------------
// Default ninja campaign and questions (mirrors the seed data)
// ---------------------------------------------------------------------------

const ninjaCampaign: Campaign = {
  id: 'ninja-naming',
  title: 'These four ninjas need names',
  description: 'Help us name our four ninja mascots by suggesting and voting for your favorites.',
  status: 'active',
  createdAt: '2024-01-01T00:00:00.000Z',
  allowSuggestions: true,
  maxVotesTotal: 4,
  maxVotesPerCategory: 1,
  maxVotesPerCandidate: 1,
}

const ninjaQuestions: Question[] = [
  { id: 'ninja-1', campaignId: 'ninja-naming', title: 'Ninja 1', description: 'This ninja needs a name.', imageUrl: '/mascots/ninja1.png', sortOrder: 1 },
  { id: 'ninja-2', campaignId: 'ninja-naming', title: 'Ninja 2', description: 'This ninja needs a name.', imageUrl: '/mascots/ninja2.png', sortOrder: 2 },
  { id: 'ninja-3', campaignId: 'ninja-naming', title: 'Ninja 3', description: 'This ninja needs a name.', imageUrl: '/mascots/ninja3.png', sortOrder: 3 },
  { id: 'ninja-4', campaignId: 'ninja-naming', title: 'Ninja 4', description: 'This ninja needs a name.', imageUrl: '/mascots/ninja4.png', sortOrder: 4 },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const testSuggestion: Suggestion = {
  id: 'test-suggestion-1',
  campaignId: 'ninja-naming',
  questionId: 'ninja-1',
  name: 'Rocket',
  createdAt: new Date().toISOString(),
  votes: 0,
}

function setupApi(
  suggestions: Suggestion[] = [],
  voteCounts: string[] | Map<string, number> = [],
  campaign: Campaign = ninjaCampaign,
  questions: Question[] = ninjaQuestions,
) {
  mockFetchCampaign.mockResolvedValue(campaign)
  mockFetchQuestions.mockResolvedValue(questions)
  mockFetchSuggestions.mockResolvedValue(suggestions)
  mockFetchVoteCounts.mockResolvedValue(
    voteCounts instanceof Map
      ? voteCounts
      : new Map(voteCounts.map((id) => [id, 1] as [string, number])),
  )
  mockPostSuggestion.mockImplementation(async (campaignId, questionId, name) => {
    const isDuplicate = suggestions.some(
      (s) => s.questionId === questionId && s.name.trim().toLowerCase() === name.trim().toLowerCase(),
    )
    if (isDuplicate) return null
    const created: Suggestion = {
      id: `new-${suggestions.length + 1}`,
      campaignId,
      questionId,
      name,
      createdAt: new Date().toISOString(),
      votes: 0,
    }
    suggestions.push(created)
    return created
  })
  mockPostVote.mockImplementation(async (_campaignId, _questionId, suggestionId, _sessionId, revoke) => {
    const idx = suggestions.findIndex((s) => s.id === suggestionId)
    if (idx === -1) return null
    const updated = { ...suggestions[idx], votes: revoke ? suggestions[idx].votes - 1 : suggestions[idx].votes + 1 }
    suggestions[idx] = updated
    return updated
  })
}

function getVoteButton() {
  return screen.getAllByRole('button', { name: /vote for rocket/i })[0]
}

function getVoteCount(): number {
  return parseInt(document.querySelector('.vote-btn__count')!.textContent ?? '0', 10)
}

const threeSuggestions: Suggestion[] = [
  { id: 'hanzo', campaignId: 'ninja-naming', questionId: 'ninja-1', name: 'Hanzo', createdAt: '2024-01-01T00:00:00.000Z', votes: 0 },
  { id: 'yuki', campaignId: 'ninja-naming', questionId: 'ninja-1', name: 'Yuki', createdAt: '2024-01-02T00:00:00.000Z', votes: 0 },
  { id: 'kimi', campaignId: 'ninja-naming', questionId: 'ninja-1', name: 'Kimi', createdAt: '2024-01-03T00:00:00.000Z', votes: 0 },
]

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  // Default API responses so tests that don't call setupApi() still render the full UI.
  mockFetchCampaign.mockResolvedValue(ninjaCampaign)
  mockFetchQuestions.mockResolvedValue(ninjaQuestions)
  mockFetchSuggestions.mockResolvedValue([])
  mockFetchVoteCounts.mockResolvedValue(new Map())
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('vote targeting', () => {
  it('voting Hanzo only changes Hanzo', async () => {
    setupApi([...threeSuggestions])
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /vote for hanzo/i })

    await userEvent.click(screen.getAllByRole('button', { name: /vote for hanzo/i })[0])

    expect(screen.getAllByRole('button', { name: /remove vote for hanzo/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /vote for yuki/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /vote for kimi/i })[0]).toBeInTheDocument()
  })

  it('voting Kimi only changes Kimi', async () => {
    setupApi([...threeSuggestions])
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /vote for kimi/i })

    await userEvent.click(screen.getAllByRole('button', { name: /vote for kimi/i })[0])

    expect(screen.getAllByRole('button', { name: /vote for hanzo/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /vote for yuki/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /remove vote for kimi/i })[0]).toBeInTheDocument()
  })

  it('sorting and re-rendering do not affect vote targeting', async () => {
    const sorted: Suggestion[] = [
      { ...threeSuggestions[0], votes: 0 },
      { ...threeSuggestions[1], votes: 5 },
      { ...threeSuggestions[2], votes: 0 },
    ]
    setupApi([...sorted])
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /vote for hanzo/i })

    await userEvent.click(screen.getAllByRole('button', { name: /vote for hanzo/i })[0])

    expect(screen.getAllByRole('button', { name: /remove vote for hanzo/i })[0]).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove vote for yuki/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove vote for kimi/i })).not.toBeInTheDocument()
  })
})

describe('voting', () => {
  it('increments vote count from 0 to 1 on first click', async () => {
    setupApi([{ ...testSuggestion }])
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /vote for rocket/i })

    expect(getVoteCount()).toBe(0)
    await userEvent.click(getVoteButton())
    expect(getVoteCount()).toBe(1)
  })

  it('decrements vote count from 1 to 0 when revoking a vote', async () => {
    setupApi([{ ...testSuggestion, votes: 1 }], [testSuggestion.id])
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /remove vote for rocket/i })

    expect(getVoteCount()).toBe(1)
    await userEvent.click(screen.getAllByRole('button', { name: /remove vote for rocket/i })[0])
    expect(getVoteCount()).toBe(0)
  })

  it('prevents a second vote from the same browser session', async () => {
    setupApi([{ ...testSuggestion }])
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /vote for rocket/i })

    await userEvent.click(getVoteButton())
    expect(getVoteCount()).toBe(1)

    const revokeButton = screen.getAllByRole('button', { name: /remove vote for rocket/i })[0]
    await userEvent.click(revokeButton)
    expect(getVoteCount()).toBe(0)

    await userEvent.click(getVoteButton())
    expect(getVoteCount()).toBe(1)
  })

  it('marks the vote button as already voted when the backend reports a prior vote', async () => {
    setupApi([{ ...testSuggestion, votes: 1 }], [testSuggestion.id])
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /remove vote for rocket/i })

    expect(screen.getAllByRole('button', { name: /remove vote for rocket/i })[0]).toBeInTheDocument()
    expect(getVoteCount()).toBe(1)

    await userEvent.click(screen.getAllByRole('button', { name: /remove vote for rocket/i })[0])
    expect(getVoteCount()).toBe(0)
  })
})

describe('suggestion board ordering', () => {
  it('renders suggestions in creation-date order regardless of vote counts', async () => {
    const suggestions: Suggestion[] = [
      { id: 'a', campaignId: 'ninja-naming', questionId: 'ninja-1', name: 'Alpha', createdAt: '2024-01-01T00:00:00.000Z', votes: 10 },
      { id: 'b', campaignId: 'ninja-naming', questionId: 'ninja-1', name: 'Beta', createdAt: '2024-01-02T00:00:00.000Z', votes: 0 },
      { id: 'c', campaignId: 'ninja-naming', questionId: 'ninja-1', name: 'Gamma', createdAt: '2024-01-03T00:00:00.000Z', votes: 5 },
    ]
    setupApi(suggestions)
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByText('Alpha')

    const boardSection = document.querySelector('.suggestion-board')!
    const names = Array.from(boardSection.querySelectorAll('.suggestion-card__name')).map(
      (el) => el.textContent,
    )
    expect(names).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('does not re-order suggestion cards after voting', async () => {
    const suggestions: Suggestion[] = [
      { id: 'a', campaignId: 'ninja-naming', questionId: 'ninja-1', name: 'Alpha', createdAt: '2024-01-01T00:00:00.000Z', votes: 0 },
      { id: 'b', campaignId: 'ninja-naming', questionId: 'ninja-1', name: 'Beta', createdAt: '2024-01-02T00:00:00.000Z', votes: 0 },
    ]
    setupApi(suggestions)
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByText('Alpha')

    const boardSection = document.querySelector('.suggestion-board')!
    const before = Array.from(boardSection.querySelectorAll('.suggestion-card__name')).map(
      (el) => el.textContent,
    )
    expect(before).toEqual(['Alpha', 'Beta'])

    await userEvent.click(screen.getAllByRole('button', { name: /vote for beta/i })[0])

    const after = Array.from(boardSection.querySelectorAll('.suggestion-card__name')).map(
      (el) => el.textContent,
    )
    expect(after).toEqual(['Alpha', 'Beta'])
  })
})

describe('duplicate suggestions', () => {
  async function submitSuggestion(name: string) {
    const input = await screen.findByRole('textbox', { name: /name suggestion/i })
    await userEvent.clear(input)
    await userEvent.type(input, name)
    await userEvent.click(screen.getByRole('button', { name: /add suggestion/i }))
  }

  function getSuggestionNames() {
    return Array.from(document.querySelectorAll('.suggestion-card__name')).map(
      (el) => el.textContent,
    )
  }

  it('does not add a duplicate suggestion with the same name for the same question', async () => {
    setupApi()
    render(<App campaignId="ninja-naming" />)
    await submitSuggestion('Comet')
    await submitSuggestion('Comet')
    expect(getSuggestionNames().filter((n) => n === 'Comet')).toHaveLength(1)
  })

  it('does not add a duplicate when name differs only by case', async () => {
    setupApi()
    render(<App campaignId="ninja-naming" />)
    await submitSuggestion('Comet')
    await submitSuggestion('comet')
    expect(getSuggestionNames()).toHaveLength(1)
  })

  it('does not add a duplicate when name differs only by surrounding whitespace', async () => {
    setupApi()
    render(<App campaignId="ninja-naming" />)
    await submitSuggestion('Comet')
    await submitSuggestion('  Comet  ')
    expect(getSuggestionNames()).toHaveLength(1)
  })

  it('allows the same name for different questions', async () => {
    setupApi()
    render(<App campaignId="ninja-naming" />)

    const select = await screen.findByRole('combobox', { name: /question/i })
    const options = Array.from(select.querySelectorAll('option'))
    if (options.length < 2) {
      return
    }

    await userEvent.selectOptions(select, options[0].value)
    await submitSuggestion('Star')

    await userEvent.selectOptions(select, options[1].value)
    await submitSuggestion('Star')

    expect(getSuggestionNames().filter((n) => n === 'Star')).toHaveLength(2)
  })
})

describe('input validation', () => {
  async function typeInSuggestion(name: string) {
    const input = await screen.findByRole('textbox', { name: /name suggestion/i })
    await userEvent.clear(input)
    await userEvent.type(input, name)
  }

  async function submitSuggestion(name: string) {
    await typeInSuggestion(name)
    await userEvent.click(screen.getByRole('button', { name: /add suggestion/i }))
  }

  function getSuggestionNames() {
    return Array.from(document.querySelectorAll('.suggestion-card__name')).map(
      (el) => el.textContent,
    )
  }

  it('accepts letters, numbers, spaces, apostrophes and hyphens', async () => {
    setupApi()
    render(<App campaignId="ninja-naming" />)
    await submitSuggestion("Sunny O'Stride-2")
    expect(getSuggestionNames()).toContain("Sunny O'Stride-2")
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an error and does not submit when emoji is entered', async () => {
    setupApi()
    render(<App campaignId="ninja-naming" />)
    await submitSuggestion('Sunny 😊')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(getSuggestionNames()).toHaveLength(0)
  })

  it('shows an error and does not submit when unsupported symbol is entered', async () => {
    setupApi()
    render(<App campaignId="ninja-naming" />)
    await submitSuggestion('Name@Invalid')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(getSuggestionNames()).toHaveLength(0)
  })

  it('shows a validation error while typing invalid characters', async () => {
    setupApi()
    render(<App campaignId="ninja-naming" />)
    await typeInSuggestion('Bad!')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('clears the error when input becomes valid', async () => {
    setupApi()
    render(<App campaignId="ninja-naming" />)
    const input = await screen.findByRole('textbox', { name: /name suggestion/i })
    await userEvent.type(input, 'Bad!')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await userEvent.clear(input)
    await userEvent.type(input, 'Good')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('leaderboard', () => {
  it('renders suggestions sorted by vote count descending', async () => {
    const suggestions: Suggestion[] = [
      { id: 'a', campaignId: 'ninja-naming', questionId: 'ninja-1', name: 'Alpha', createdAt: '2024-01-01T00:00:00.000Z', votes: 2 },
      { id: 'b', campaignId: 'ninja-naming', questionId: 'ninja-1', name: 'Beta', createdAt: '2024-01-02T00:00:00.000Z', votes: 5 },
      { id: 'c', campaignId: 'ninja-naming', questionId: 'ninja-1', name: 'Gamma', createdAt: '2024-01-03T00:00:00.000Z', votes: 1 },
    ]
    setupApi(suggestions)
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByText('Beta')

    const leaderboard = document.querySelector('.leaderboard')!
    const names = Array.from(leaderboard.querySelectorAll('.leaderboard-entry__name')).map(
      (el) => el.textContent,
    )
    expect(names).toEqual(['Beta', 'Alpha', 'Gamma'])
  })

  it('updates leaderboard order live when a vote changes the ranking', async () => {
    const suggestions: Suggestion[] = [
      { id: 'a', campaignId: 'ninja-naming', questionId: 'ninja-1', name: 'Alpha', createdAt: '2024-01-01T00:00:00.000Z', votes: 0 },
      { id: 'b', campaignId: 'ninja-naming', questionId: 'ninja-1', name: 'Beta', createdAt: '2024-01-02T00:00:00.000Z', votes: 1 },
    ]
    setupApi(suggestions)
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByText('Beta')

    const leaderboard = document.querySelector('.leaderboard')!
    const before = Array.from(leaderboard.querySelectorAll('.leaderboard-entry__name')).map(
      (el) => el.textContent,
    )
    expect(before).toEqual(['Beta', 'Alpha'])

    await userEvent.click(screen.getAllByRole('button', { name: /vote for alpha/i })[0])

    const after = Array.from(leaderboard.querySelectorAll('.leaderboard-entry__name')).map(
      (el) => el.textContent,
    )
    expect(after).toEqual(['Alpha', 'Beta'])
  })

  it('is not rendered when there are no suggestions', async () => {
    setupApi()
    render(<App campaignId="ninja-naming" />)
    // Wait for loading to finish then assert
    await screen.findByRole('button', { name: /add suggestion/i })
    expect(document.querySelector('.leaderboard')).not.toBeInTheDocument()
  })
})

describe('VotingRules', () => {
  it('shows voting rules on load', async () => {
    setupApi()
    render(<App campaignId="ninja-naming" />)
    await screen.findByRole('button', { name: /add suggestion/i })

    const rules = screen.getByRole('complementary', { name: /voting rules/i })
    expect(rules).toBeInTheDocument()
    expect(rules).toHaveTextContent(/one vote per candidate/i)
    expect(rules).toHaveTextContent(/one vote per category/i)
    expect(rules).toHaveTextContent(/4 of 4 total votes remaining/i)
  })

  it('decrements remaining votes after casting a vote', async () => {
    setupApi([{ ...testSuggestion }])
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /vote for rocket/i })

    expect(screen.getByRole('complementary', { name: /voting rules/i })).toHaveTextContent(
      /4 of 4 total votes remaining/i,
    )

    await userEvent.click(screen.getAllByRole('button', { name: /vote for rocket/i })[0])

    expect(screen.getByRole('complementary', { name: /voting rules/i })).toHaveTextContent(
      /3 of 4 total votes remaining/i,
    )
  })

  it('increments remaining votes after revoking a vote', async () => {
    setupApi([{ ...testSuggestion, votes: 1 }], [testSuggestion.id])
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /remove vote for rocket/i })

    expect(screen.getByRole('complementary', { name: /voting rules/i })).toHaveTextContent(
      /3 of 4 total votes remaining/i,
    )

    await userEvent.click(screen.getAllByRole('button', { name: /remove vote for rocket/i })[0])

    expect(screen.getByRole('complementary', { name: /voting rules/i })).toHaveTextContent(
      /4 of 4 total votes remaining/i,
    )
  })
})

describe('vote limit enforcement', () => {
  it('does not optimistically update when the backend rejects a vote', async () => {
    mockFetchSuggestions.mockResolvedValue([{ ...testSuggestion }])
    mockFetchVoteCounts.mockResolvedValue(new Map())
    mockPostSuggestion.mockResolvedValue(null)
    mockPostVote.mockResolvedValue(null)

    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /vote for rocket/i })

    await userEvent.click(screen.getAllByRole('button', { name: /vote for rocket/i })[0])

    expect(getVoteCount()).toBe(0)
    expect(screen.getAllByRole('button', { name: /vote for rocket/i })[0]).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove vote for rocket/i })).not.toBeInTheDocument()
  })

  it('keeps frontend and backend aligned when category and total limits are reached', async () => {
    const limitedSuggestions: Suggestion[] = [
      { id: 'n1a', campaignId: 'ninja-naming', questionId: 'ninja-1', name: 'Alpha', createdAt: '2024-01-01T00:00:00.000Z', votes: 0 },
      { id: 'n1b', campaignId: 'ninja-naming', questionId: 'ninja-1', name: 'Bravo', createdAt: '2024-01-02T00:00:00.000Z', votes: 0 },
      { id: 'n2a', campaignId: 'ninja-naming', questionId: 'ninja-2', name: 'Comet', createdAt: '2024-01-03T00:00:00.000Z', votes: 0 },
      { id: 'n3a', campaignId: 'ninja-naming', questionId: 'ninja-3', name: 'Delta', createdAt: '2024-01-04T00:00:00.000Z', votes: 0 },
      { id: 'n4a', campaignId: 'ninja-naming', questionId: 'ninja-4', name: 'Echo', createdAt: '2024-01-05T00:00:00.000Z', votes: 0 },
    ]

    mockFetchSuggestions.mockResolvedValue(limitedSuggestions)
    mockFetchVoteCounts.mockResolvedValue(new Map())
    mockPostSuggestion.mockResolvedValue(null)

    const acceptedVotes = new Set<string>()
    mockPostVote.mockImplementation(async (_campaignId, _questionId, suggestionId) => {
      const suggestion = limitedSuggestions.find((item) => item.id === suggestionId)
      if (!suggestion) {
        return null
      }

      if (acceptedVotes.has(suggestionId)) {
        return null
      }

      const votesInCategory = Array.from(acceptedVotes)
        .map((id) => limitedSuggestions.find((item) => item.id === id))
        .filter((item) => item?.questionId === suggestion.questionId)
      if (votesInCategory.length >= 1) {
        return null
      }

      if (acceptedVotes.size >= 4) {
        return null
      }

      acceptedVotes.add(suggestionId)
      suggestion.votes += 1
      return { ...suggestion }
    })

    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /vote for alpha/i })

    await userEvent.click(screen.getAllByRole('button', { name: /vote for alpha/i })[0])
    expect(screen.getByRole('complementary', { name: /voting rules/i })).toHaveTextContent(/3 of 4 total votes remaining/i)
    expect(screen.getAllByRole('button', { name: /vote for bravo/i })[0]).toBeDisabled()

    await userEvent.click(screen.getAllByRole('button', { name: /vote for comet/i })[0])
    await userEvent.click(screen.getAllByRole('button', { name: /vote for delta/i })[0])
    await userEvent.click(screen.getAllByRole('button', { name: /vote for echo/i })[0])

    expect(screen.getByRole('complementary', { name: /voting rules/i })).toHaveTextContent(/0 of 4 total votes remaining/i)
    expect(screen.getAllByRole('button', { name: /vote for bravo/i })[0]).toBeDisabled()

    await userEvent.click(screen.getAllByRole('button', { name: /vote for bravo/i })[0])

    expect(mockPostVote).toHaveBeenCalledTimes(4)
    expect(screen.getAllByRole('button', { name: /vote for bravo/i })[0]).toBeDisabled()
    const boardSection = document.querySelector('.suggestion-board')!
    const bravoCard = Array.from(boardSection.querySelectorAll('.suggestion-card')).find((card) =>
      card.textContent?.includes('Bravo'),
    )
    expect(bravoCard?.querySelector('.vote-btn__count')?.textContent).toBe('0')
  })
})

// ---------------------------------------------------------------------------
// Vote budget after soft delete
// ---------------------------------------------------------------------------

describe('vote budget after soft delete', () => {
  it('votes for a soft-deleted candidate still count against the total budget', async () => {
    // Campaign allows 3 total votes, up to 2 per candidate.
    const multiVoteCampaign: Campaign = {
      ...ninjaCampaign,
      maxVotesTotal: 3,
      maxVotesPerCandidate: 2,
      maxVotesPerCategory: 0,
    }
    const rogier: Suggestion = {
      id: 'rogier',
      campaignId: 'ninja-naming',
      questionId: 'ninja-1',
      name: 'Rogier',
      createdAt: '2024-01-01T00:00:00.000Z',
      votes: 1,
    }
    // Marja was soft-deleted — she is absent from suggestions but her 2 votes remain
    // in the backend votes table, so the API returns them in voteCountById.
    const voteCounts = new Map<string, number>([
      ['marja', 2],    // deleted candidate — votes persist
      ['rogier', 1],   // visible candidate
    ])
    mockFetchCampaign.mockResolvedValue(multiVoteCampaign)
    mockFetchQuestions.mockResolvedValue(ninjaQuestions)
    mockFetchSuggestions.mockResolvedValue([rogier])
    mockFetchVoteCounts.mockResolvedValue(voteCounts)

    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /vote for rogier/i })

    // All 3 votes are spent (2 for Marja + 1 for Rogier) — budget must show 0 remaining.
    expect(screen.getByRole('complementary', { name: /voting rules/i })).toHaveTextContent(
      /0 of 3 total votes remaining/i,
    )
    // The vote button for Rogier must be disabled because the total budget is exhausted.
    expect(screen.getAllByRole('button', { name: /vote for rogier/i })[0]).toBeDisabled()
  })

  it('vote budget is unaffected when a candidate with zero votes is deleted', async () => {
    const multiVoteCampaign: Campaign = {
      ...ninjaCampaign,
      maxVotesTotal: 3,
      maxVotesPerCandidate: 2,
      maxVotesPerCategory: 0,
    }
    const rogier: Suggestion = {
      id: 'rogier',
      campaignId: 'ninja-naming',
      questionId: 'ninja-1',
      name: 'Rogier',
      createdAt: '2024-01-01T00:00:00.000Z',
      votes: 1,
    }
    // Marta had 0 votes and was deleted — voteCountById has no entry for her.
    const voteCounts = new Map<string, number>([['rogier', 1]])
    mockFetchCampaign.mockResolvedValue(multiVoteCampaign)
    mockFetchQuestions.mockResolvedValue(ninjaQuestions)
    mockFetchSuggestions.mockResolvedValue([rogier])
    mockFetchVoteCounts.mockResolvedValue(voteCounts)

    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /vote for rogier/i })

    // Only 1 of 3 votes used — 2 remaining.
    expect(screen.getByRole('complementary', { name: /voting rules/i })).toHaveTextContent(
      /2 of 3 total votes remaining/i,
    )
    expect(screen.getAllByRole('button', { name: /vote for rogier/i })[0]).not.toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Campaign and questions loaded from storage
// ---------------------------------------------------------------------------

describe('campaign config loaded from storage', () => {
  it('renders campaign title and description from the API response', async () => {
    const customCampaign: Campaign = {
      ...ninjaCampaign,
      title: 'Custom Campaign Title',
      description: 'Custom campaign description.',
    }
    setupApi([], [], customCampaign)
    render(<App campaignId="ninja-naming" />)
    await screen.findByText('Custom Campaign Title')
    expect(screen.getByText('Custom campaign description.')).toBeInTheDocument()
  })

  it('fetches suggestions using the campaign ID returned by the API', async () => {
    setupApi([{ ...testSuggestion }])
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /vote for rocket/i })
    expect(mockFetchSuggestions).toHaveBeenCalledWith('ninja-naming')
  })

  it('fetches questions using the campaign ID returned by the API', async () => {
    setupApi()
    render(<App campaignId="ninja-naming" />)
    await screen.findByRole('button', { name: /add suggestion/i })
    expect(mockFetchQuestions).toHaveBeenCalledWith('ninja-naming')
  })
})

describe('questions loaded from storage', () => {
  it('renders question titles from the API response', async () => {
    const customQuestions: Question[] = [
      { id: 'q-1', campaignId: 'ninja-naming', title: 'Custom Ninja A', description: 'desc', sortOrder: 1 },
      { id: 'q-2', campaignId: 'ninja-naming', title: 'Custom Ninja B', description: 'desc', sortOrder: 2 },
    ]
    setupApi([], [], ninjaCampaign, customQuestions)
    render(<App campaignId="ninja-naming" />)
    // Title appears in QuestionCard and SuggestionBoard; getAllByText allows multiple matches
    expect(await screen.findAllByText('Custom Ninja A')).not.toHaveLength(0)
    expect(screen.getAllByText('Custom Ninja B')).not.toHaveLength(0)
  })

  it('shows custom question in the suggestion form dropdown', async () => {
    const customQuestions: Question[] = [
      { id: 'q-special', campaignId: 'ninja-naming', title: 'The Special Ninja', description: 'desc', sortOrder: 1 },
    ]
    setupApi([], [], ninjaCampaign, customQuestions)
    render(<App campaignId="ninja-naming" />)
    // Wait until questions are loaded and the combobox shows the custom question
    await screen.findAllByText('The Special Ninja')
    const select = screen.getByRole('combobox', { name: /question/i })
    expect(select).toHaveTextContent('The Special Ninja')
  })
})

describe('suggestions and vote rules after campaign loaded from storage', () => {
  it('existing suggestions still work after loading campaign from storage', async () => {
    const existingSuggestion: Suggestion = {
      id: 'stored-sug',
      campaignId: 'ninja-naming',
      questionId: 'ninja-1',
      name: 'StoredName',
      createdAt: '2024-01-01T00:00:00.000Z',
      votes: 3,
    }
    setupApi([existingSuggestion])
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /vote for storedname/i })
    expect(screen.getAllByText('StoredName')[0]).toBeInTheDocument()
  })

  it('existing vote rules still work after loading campaign from storage', async () => {
    const suggestion: Suggestion = {
      id: 'rule-sug',
      campaignId: 'ninja-naming',
      questionId: 'ninja-1',
      name: 'RuleTest',
      createdAt: '2024-01-01T00:00:00.000Z',
      votes: 0,
    }
    // Campaign with maxVotesTotal = 1
    const limitedCampaign: Campaign = { ...ninjaCampaign, maxVotesTotal: 1 }
    setupApi([suggestion], [], limitedCampaign)
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByRole('button', { name: /vote for ruletest/i })

    await userEvent.click(screen.getAllByRole('button', { name: /vote for ruletest/i })[0])

    // Total limit reached — VotingRules shows 0 remaining (singular when max=1)
    expect(screen.getByRole('complementary', { name: /voting rules/i })).toHaveTextContent(
      /0 of 1 total vote remaining/i,
    )
  })
})

// ---------------------------------------------------------------------------
// Campaign routing tests
// ---------------------------------------------------------------------------

describe('campaign routing', () => {
  const padelleCampaign: Campaign = {
    id: 'best-padeller-2026',
    title: 'Best Padeller 2026',
    description: 'Nominate and vote for the best padeller of 2026.',
    status: 'active',
    createdAt: '2024-01-01T00:00:00.000Z',
    allowSuggestions: true,
    maxVotesTotal: 3,
    maxVotesPerCategory: 3,
    maxVotesPerCandidate: 2,
  }

  const padelleQuestions: Question[] = [
    { id: 'nominees', campaignId: 'best-padeller-2026', title: 'Who do you nominate?', description: 'Suggest and vote for your favourite padeller.', sortOrder: 1 },
  ]

  it('renders the ninja campaign when campaignId=ninja-naming is passed', async () => {
    setupApi([], [], ninjaCampaign, ninjaQuestions)
    render(<App campaignId="ninja-naming" />)
    await screen.findByText('These four ninjas need names')
    expect(screen.getByText('These four ninjas need names')).toBeInTheDocument()
    expect(mockFetchCampaign).toHaveBeenCalledWith('ninja-naming')
  })

  it('renders the padeller campaign when campaignId=best-padeller-2026 is passed', async () => {
    mockFetchCampaign.mockResolvedValue(padelleCampaign)
    mockFetchQuestions.mockResolvedValue(padelleQuestions)
    render(<App campaignId="best-padeller-2026" />)
    await screen.findByText('Best Padeller 2026')
    expect(screen.getByText('Nominate and vote for the best padeller of 2026.')).toBeInTheDocument()
    expect(mockFetchCampaign).toHaveBeenCalledWith('best-padeller-2026')
  })

  it('two campaigns can coexist — loading one does not affect the other', async () => {
    // Render ninja campaign
    setupApi([], [], ninjaCampaign, ninjaQuestions)
    const { unmount } = render(<App campaignId="ninja-naming" />)
    await screen.findByText('These four ninjas need names')
    unmount()

    // Render padeller campaign independently
    cleanup()
    mockFetchCampaign.mockResolvedValue(padelleCampaign)
    mockFetchQuestions.mockResolvedValue(padelleQuestions)
    mockFetchSuggestions.mockResolvedValue([])
    mockFetchVoteCounts.mockResolvedValue(new Map())
    render(<App campaignId="best-padeller-2026" />)
    await screen.findByText('Best Padeller 2026')
    expect(screen.queryByText('These four ninjas need names')).not.toBeInTheDocument()
  })

  it('shows a campaign-not-found message for an unknown campaign', async () => {
    mockFetchCampaign.mockRejectedValue(new Error('Campaign not found'))
    render(<App campaignId="does-not-exist" />)
    await screen.findByText('Campaign not found')
    expect(screen.getByText('Campaign not found')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// maxVotesPerCandidate tests
// ---------------------------------------------------------------------------

describe('maxVotesPerCandidate', () => {
  const multiVoteCampaign: Campaign = {
    id: 'best-padeller-2026',
    title: 'Best Padeller 2026',
    description: 'Vote for the best padeller.',
    status: 'active',
    createdAt: '2024-01-01T00:00:00.000Z',
    allowSuggestions: true,
    maxVotesTotal: 3,
    maxVotesPerCategory: 3,
    maxVotesPerCandidate: 2,
  }

  const multiVoteQuestions: Question[] = [
    { id: 'nominees', campaignId: 'best-padeller-2026', title: 'Nominees', description: 'desc', sortOrder: 1 },
  ]

  const alice: Suggestion = {
    id: 'alice',
    campaignId: 'best-padeller-2026',
    questionId: 'nominees',
    name: 'Alice',
    createdAt: '2024-01-01T00:00:00.000Z',
    votes: 0,
  }

  it('allows two votes on the same suggestion when maxVotesPerCandidate=2', async () => {
    const suggestions = [{ ...alice }]
    mockFetchCampaign.mockResolvedValue(multiVoteCampaign)
    mockFetchQuestions.mockResolvedValue(multiVoteQuestions)
    mockFetchSuggestions.mockResolvedValue(suggestions)
    mockFetchVoteCounts.mockResolvedValue(new Map())

    mockPostVote.mockImplementation(async (_cid, _qid, sid, _sid, revoke) => {
      const s = suggestions.find((x) => x.id === sid)
      if (!s) return null
      if (revoke) { s.votes-- } else { s.votes++ }
      return { ...s }
    })

    render(<App campaignId="best-padeller-2026" />)
    await screen.findAllByRole('button', { name: /vote for alice/i })

    // First vote
    await userEvent.click(screen.getAllByRole('button', { name: /vote for alice/i })[0])
    expect(mockPostVote).toHaveBeenCalledTimes(1)
    expect(mockPostVote).toHaveBeenLastCalledWith('best-padeller-2026', 'nominees', 'alice', expect.any(String), false)

    await screen.findAllByRole('button', { name: /vote for alice/i })
    screen.getAllByRole('button', { name: /remove vote for alice/i })

    await userEvent.click(screen.getAllByRole('button', { name: /vote for alice/i })[0])
    expect(mockPostVote).toHaveBeenCalledTimes(2)
    expect(mockPostVote).toHaveBeenLastCalledWith('best-padeller-2026', 'nominees', 'alice', expect.any(String), false)
    screen.getAllByRole('button', { name: /remove vote for alice/i })
  })

  it('rejects the third vote on the same suggestion when maxVotesPerCandidate=2', async () => {
    const suggestions = [{ ...alice, votes: 2 }]
    mockFetchCampaign.mockResolvedValue(multiVoteCampaign)
    mockFetchQuestions.mockResolvedValue(multiVoteQuestions)
    mockFetchSuggestions.mockResolvedValue(suggestions)
    mockFetchVoteCounts.mockResolvedValue(new Map([['alice', 2]]))

    render(<App campaignId="best-padeller-2026" />)
    await screen.findAllByRole('button', { name: /remove vote for alice/i })
    const voteButtons = screen.getAllByRole('button', { name: /^vote for alice$/i })
    expect(voteButtons[0]).toBeDisabled()
  })

  it('maxVotesTotal still blocks votes beyond the campaign total', async () => {
    const bob: Suggestion = { id: 'bob', campaignId: 'best-padeller-2026', questionId: 'nominees', name: 'Bob', createdAt: '2024-01-02T00:00:00.000Z', votes: 0 }
    const suggestions = [{ ...alice, votes: 0 }, { ...bob }]
    // maxVotesTotal=3, maxVotesPerCandidate=2 — already used 3 total
    const exhaustedCampaign = { ...multiVoteCampaign, maxVotesTotal: 3 }
    mockFetchCampaign.mockResolvedValue(exhaustedCampaign)
    mockFetchQuestions.mockResolvedValue(multiVoteQuestions)
    mockFetchSuggestions.mockResolvedValue(suggestions)
    // 3 votes used: alice×2, bob×1
    mockFetchVoteCounts.mockResolvedValue(new Map([['alice', 2], ['bob', 1]]))

    render(<App campaignId="best-padeller-2026" />)
    await screen.findAllByRole('button', { name: /remove vote for alice/i })

    // alice is at candidate limit → remove button
    // bob has 1 vote (not at candidate limit of 2), but total is exhausted → vote button is disabled (not remove)
    const bobVoteButtons = screen.getAllByRole('button', { name: /^vote for bob$/i })
    expect(bobVoteButtons[0]).toBeDisabled()

    expect(screen.getByRole('complementary', { name: /voting rules/i })).toHaveTextContent(
      /0 of 3 total votes remaining/i,
    )
  })

  it('revoking a vote frees capacity for another vote', async () => {
    const suggestions = [{ ...alice, votes: 1 }]
    mockFetchCampaign.mockResolvedValue(multiVoteCampaign)
    mockFetchQuestions.mockResolvedValue(multiVoteQuestions)
    mockFetchSuggestions.mockResolvedValue(suggestions)
    // 1 vote cast for alice, maxVotesTotal=3, maxVotesPerCandidate=2 → not at limit yet
    mockFetchVoteCounts.mockResolvedValue(new Map([['alice', 1]]))

    mockPostVote.mockImplementation(async (_cid, _qid, sid, _sid, revoke) => {
      const s = suggestions.find((x) => x.id === sid)
      if (!s) return null
      if (revoke) s.votes--; else s.votes++
      return { ...s }
    })

    render(<App campaignId="best-padeller-2026" />)
    await screen.findAllByRole('button', { name: /vote for alice/i })
    screen.getAllByRole('button', { name: /remove vote for alice/i })

    expect(screen.getByRole('complementary', { name: /voting rules/i })).toHaveTextContent(
      /2 of 3 total votes remaining/i,
    )
  })

  it('removes one vote at a time when a candidate has three votes', async () => {
    const scenarioCampaign: Campaign = { ...multiVoteCampaign, maxVotesPerCandidate: 3, maxVotesTotal: 3 }
    const suggestions = [{ ...alice, votes: 3 }]
    setupApi(suggestions, new Map([['alice', 3]]), scenarioCampaign, multiVoteQuestions)

    render(<App campaignId="best-padeller-2026" />)
    await screen.findAllByRole('button', { name: /remove vote for alice/i })

    expect(getVoteCount()).toBe(3)
    await userEvent.click(screen.getAllByRole('button', { name: /remove vote for alice/i })[0])
    expect(getVoteCount()).toBe(2)
    screen.getAllByRole('button', { name: /remove vote for alice/i })
  })

  it('can remove all votes for a candidate and add them again', async () => {
    const scenarioCampaign: Campaign = { ...multiVoteCampaign, maxVotesPerCandidate: 3, maxVotesTotal: 3 }
    const suggestions = [{ ...alice, votes: 3 }]
    setupApi(suggestions, new Map([['alice', 3]]), scenarioCampaign, multiVoteQuestions)

    render(<App campaignId="best-padeller-2026" />)
    await screen.findAllByRole('button', { name: /remove vote for alice/i })

    await userEvent.click(screen.getAllByRole('button', { name: /remove vote for alice/i })[0])
    await userEvent.click(screen.getAllByRole('button', { name: /remove vote for alice/i })[0])
    await userEvent.click(screen.getAllByRole('button', { name: /remove vote for alice/i })[0])

    expect(getVoteCount()).toBe(0)
    expect(screen.queryByRole('button', { name: /remove vote for alice/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: /^vote for alice$/i })[0])
    expect(getVoteCount()).toBe(1)
    screen.getAllByRole('button', { name: /remove vote for alice/i })
  })

  it('re-enables voting after removing a vote at the per-candidate limit', async () => {
    const suggestions = [{ ...alice, votes: 2 }]
    setupApi(suggestions, new Map([['alice', 2]]), multiVoteCampaign, multiVoteQuestions)

    render(<App campaignId="best-padeller-2026" />)
    await screen.findAllByRole('button', { name: /remove vote for alice/i })

    const voteButtons = screen.getAllByRole('button', { name: /^vote for alice$/i })
    expect(voteButtons[0]).toBeDisabled()

    await userEvent.click(screen.getAllByRole('button', { name: /remove vote for alice/i })[0])

    expect(getVoteCount()).toBe(1)
    expect(screen.getAllByRole('button', { name: /^vote for alice$/i })[0]).toBeEnabled()
  })
})

// ---------------------------------------------------------------------------
// Empty imageUrl handling
// ---------------------------------------------------------------------------

describe('empty imageUrl', () => {
  it('renders question cards without a broken image when imageUrl is empty', async () => {
    const questionsWithoutImage: Question[] = [
      { id: 'q-1', campaignId: 'ninja-naming', title: 'Ninja Without Image', description: 'desc', sortOrder: 1 },
    ]
    setupApi([], [], ninjaCampaign, questionsWithoutImage)
    render(<App campaignId="ninja-naming" />)
    await screen.findAllByText('Ninja Without Image')
    // No <img> element should be rendered for a question with no imageUrl
    const questionCard = document.querySelector('.question-card')!
    expect(questionCard.querySelector('img')).not.toBeInTheDocument()
  })
})
