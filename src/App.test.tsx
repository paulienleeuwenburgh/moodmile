import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Campaign, Question, Suggestion } from './types'

// ---------------------------------------------------------------------------
// Mock the API module so tests never make real HTTP calls
// ---------------------------------------------------------------------------
const mockFetchCampaign = vi.fn<() => Promise<Campaign>>()
const mockFetchQuestions = vi.fn<(campaignId: string) => Promise<Question[]>>()
const mockFetchSuggestions = vi.fn<(campaignId: string) => Promise<Suggestion[]>>()
const mockFetchVotedIds = vi.fn<(campaignId: string, sessionId: string) => Promise<Set<string>>>()
const mockPostSuggestion = vi.fn<(campaignId: string, questionId: string, name: string) => Promise<Suggestion | null>>()
const mockPostVote = vi.fn<
  (campaignId: string, questionId: string, suggestionId: string, sessionId: string, revoke: boolean) => Promise<Suggestion | null>
>()

vi.mock('./api', () => ({
  fetchCampaign: (...args: Parameters<typeof mockFetchCampaign>) => mockFetchCampaign(...args),
  fetchQuestions: (...args: Parameters<typeof mockFetchQuestions>) => mockFetchQuestions(...args),
  fetchSuggestions: (...args: Parameters<typeof mockFetchSuggestions>) =>
    mockFetchSuggestions(...args),
  fetchVotedIds: (...args: Parameters<typeof mockFetchVotedIds>) => mockFetchVotedIds(...args),
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
  votedIds: string[] = [],
  campaign: Campaign = ninjaCampaign,
  questions: Question[] = ninjaQuestions,
) {
  mockFetchCampaign.mockResolvedValue(campaign)
  mockFetchQuestions.mockResolvedValue(questions)
  mockFetchSuggestions.mockResolvedValue(suggestions)
  mockFetchVotedIds.mockResolvedValue(new Set(votedIds))
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
    render(<App />)
    await screen.findAllByRole('button', { name: /vote for hanzo/i })

    await userEvent.click(screen.getAllByRole('button', { name: /vote for hanzo/i })[0])

    expect(screen.getAllByRole('button', { name: /remove vote for hanzo/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /vote for yuki/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /vote for kimi/i })[0]).toBeInTheDocument()
  })

  it('voting Kimi only changes Kimi', async () => {
    setupApi([...threeSuggestions])
    render(<App />)
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
    render(<App />)
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
    render(<App />)
    await screen.findAllByRole('button', { name: /vote for rocket/i })

    expect(getVoteCount()).toBe(0)
    await userEvent.click(getVoteButton())
    expect(getVoteCount()).toBe(1)
  })

  it('decrements vote count from 1 to 0 when revoking a vote', async () => {
    setupApi([{ ...testSuggestion, votes: 1 }], [testSuggestion.id])
    render(<App />)
    await screen.findAllByRole('button', { name: /remove vote for rocket/i })

    expect(getVoteCount()).toBe(1)
    await userEvent.click(screen.getAllByRole('button', { name: /remove vote for rocket/i })[0])
    expect(getVoteCount()).toBe(0)
  })

  it('prevents a second vote from the same browser session', async () => {
    setupApi([{ ...testSuggestion }])
    render(<App />)
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
    render(<App />)
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
    render(<App />)
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
    render(<App />)
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
    const input = screen.getByRole('textbox', { name: /name suggestion/i })
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
    render(<App />)
    await submitSuggestion('Comet')
    await submitSuggestion('Comet')
    expect(getSuggestionNames().filter((n) => n === 'Comet')).toHaveLength(1)
  })

  it('does not add a duplicate when name differs only by case', async () => {
    setupApi()
    render(<App />)
    await submitSuggestion('Comet')
    await submitSuggestion('comet')
    expect(getSuggestionNames()).toHaveLength(1)
  })

  it('does not add a duplicate when name differs only by surrounding whitespace', async () => {
    setupApi()
    render(<App />)
    await submitSuggestion('Comet')
    await submitSuggestion('  Comet  ')
    expect(getSuggestionNames()).toHaveLength(1)
  })

  it('allows the same name for different questions', async () => {
    setupApi()
    render(<App />)

    const select = screen.getByRole('combobox', { name: /question/i })
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
    const input = screen.getByRole('textbox', { name: /name suggestion/i })
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
    render(<App />)
    await submitSuggestion("Sunny O'Stride-2")
    expect(getSuggestionNames()).toContain("Sunny O'Stride-2")
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an error and does not submit when emoji is entered', async () => {
    setupApi()
    render(<App />)
    await submitSuggestion('Sunny 😊')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(getSuggestionNames()).toHaveLength(0)
  })

  it('shows an error and does not submit when unsupported symbol is entered', async () => {
    setupApi()
    render(<App />)
    await submitSuggestion('Name@Invalid')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(getSuggestionNames()).toHaveLength(0)
  })

  it('shows a validation error while typing invalid characters', async () => {
    setupApi()
    render(<App />)
    await typeInSuggestion('Bad!')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('clears the error when input becomes valid', async () => {
    setupApi()
    render(<App />)
    const input = screen.getByRole('textbox', { name: /name suggestion/i })
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
    render(<App />)
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
    render(<App />)
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
    render(<App />)
    // Wait for loading to finish then assert
    await screen.findByRole('button', { name: /add suggestion/i })
    expect(document.querySelector('.leaderboard')).not.toBeInTheDocument()
  })
})

describe('VotingRules', () => {
  it('shows voting rules on load', async () => {
    setupApi()
    render(<App />)
    await screen.findByRole('button', { name: /add suggestion/i })

    const rules = screen.getByRole('complementary', { name: /voting rules/i })
    expect(rules).toBeInTheDocument()
    expect(rules).toHaveTextContent(/one vote per candidate/i)
    expect(rules).toHaveTextContent(/one vote per category/i)
    expect(rules).toHaveTextContent(/4 of 4 total votes remaining/i)
  })

  it('decrements remaining votes after casting a vote', async () => {
    setupApi([{ ...testSuggestion }])
    render(<App />)
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
    render(<App />)
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
    mockFetchVotedIds.mockResolvedValue(new Set())
    mockPostSuggestion.mockResolvedValue(null)
    mockPostVote.mockResolvedValue(null)

    render(<App />)
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
    mockFetchVotedIds.mockResolvedValue(new Set())
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

    render(<App />)
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
    render(<App />)
    await screen.findByText('Custom Campaign Title')
    expect(screen.getByText('Custom campaign description.')).toBeInTheDocument()
  })

  it('fetches suggestions using the campaign ID returned by the API', async () => {
    setupApi([{ ...testSuggestion }])
    render(<App />)
    await screen.findAllByRole('button', { name: /vote for rocket/i })
    expect(mockFetchSuggestions).toHaveBeenCalledWith('ninja-naming')
  })

  it('fetches questions using the campaign ID returned by the API', async () => {
    setupApi()
    render(<App />)
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
    render(<App />)
    // Title appears in QuestionCard and SuggestionBoard; getAllByText allows multiple matches
    expect(await screen.findAllByText('Custom Ninja A')).not.toHaveLength(0)
    expect(screen.getAllByText('Custom Ninja B')).not.toHaveLength(0)
  })

  it('shows custom question in the suggestion form dropdown', async () => {
    const customQuestions: Question[] = [
      { id: 'q-special', campaignId: 'ninja-naming', title: 'The Special Ninja', description: 'desc', sortOrder: 1 },
    ]
    setupApi([], [], ninjaCampaign, customQuestions)
    render(<App />)
    // Wait until questions are loaded and the combobox shows the custom question
    const select = screen.getByRole('combobox', { name: /question/i })
    await screen.findAllByText('The Special Ninja')
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
    render(<App />)
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
    render(<App />)
    await screen.findAllByRole('button', { name: /vote for ruletest/i })

    await userEvent.click(screen.getAllByRole('button', { name: /vote for ruletest/i })[0])

    // Total limit reached — VotingRules shows 0 remaining (singular when max=1)
    expect(screen.getByRole('complementary', { name: /voting rules/i })).toHaveTextContent(
      /0 of 1 total vote remaining/i,
    )
  })
})
