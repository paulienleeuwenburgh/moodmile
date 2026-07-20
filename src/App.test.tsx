import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Suggestion } from './types'

// ---------------------------------------------------------------------------
// Mock the API module so tests never make real HTTP calls
// ---------------------------------------------------------------------------
const mockFetchSuggestions = vi.fn<(campaignId: string) => Promise<Suggestion[]>>()
const mockFetchVotedIds = vi.fn<(campaignId: string, sessionId: string) => Promise<Set<string>>>()
const mockPostSuggestion = vi.fn<(campaignId: string, questionId: string, name: string) => Promise<Suggestion | null>>()
const mockPostVote = vi.fn<
  (campaignId: string, questionId: string, suggestionId: string, sessionId: string, revoke: boolean) => Promise<Suggestion | null>
>()

vi.mock('./api', () => ({
  fetchSuggestions: (...args: Parameters<typeof mockFetchSuggestions>) =>
    mockFetchSuggestions(...args),
  fetchVotedIds: (...args: Parameters<typeof mockFetchVotedIds>) => mockFetchVotedIds(...args),
  postSuggestion: (...args: Parameters<typeof mockPostSuggestion>) => mockPostSuggestion(...args),
  postVote: (...args: Parameters<typeof mockPostVote>) => mockPostVote(...args),
}))

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
) {
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
