import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import type { Suggestion } from './types'

const SUGGESTIONS_KEY = 'moodmile-suggestions-v1'
const VOTES_KEY = 'moodmile-votes-v1'

const testSuggestion: Suggestion = {
  id: 'test-suggestion-1',
  mascotId: 'comet',
  name: 'Rocket',
  createdAt: new Date().toISOString(),
  votes: 0,
}

function seedSuggestion(suggestion: Suggestion = testSuggestion) {
  localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify([suggestion]))
}

function seedVotedIds(ids: string[]) {
  localStorage.setItem(VOTES_KEY, JSON.stringify(ids))
}

function getVoteButton() {
  return screen.getByRole('button', { name: /vote for rocket/i })
}

function getVoteCount(): number {
  return parseInt(document.querySelector('.vote-btn__count')!.textContent ?? '0', 10)
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})

const threeSuggestions: Suggestion[] = [
  { id: 'hanzo', mascotId: 'comet', name: 'Hanzo', createdAt: '2024-01-01T00:00:00.000Z', votes: 0 },
  { id: 'yuki', mascotId: 'comet', name: 'Yuki', createdAt: '2024-01-02T00:00:00.000Z', votes: 0 },
  { id: 'kimi', mascotId: 'comet', name: 'Kimi', createdAt: '2024-01-03T00:00:00.000Z', votes: 0 },
]

function seedSuggestions(suggestions: Suggestion[]) {
  localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(suggestions))
}

describe('vote targeting', () => {
  it('voting Hanzo only changes Hanzo', async () => {
    seedSuggestions(threeSuggestions)
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /vote for hanzo/i }))

    expect(screen.getByRole('button', { name: /remove vote for hanzo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /vote for yuki/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /vote for kimi/i })).toBeInTheDocument()
  })

  it('voting Kimi only changes Kimi', async () => {
    seedSuggestions(threeSuggestions)
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /vote for kimi/i }))

    expect(screen.getByRole('button', { name: /vote for hanzo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /vote for yuki/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove vote for kimi/i })).toBeInTheDocument()
  })

  it('sorting and re-rendering do not affect vote targeting', async () => {
    // Yuki starts with 5 votes so it sorts to the top; Hanzo and Kimi have 0
    const sorted: Suggestion[] = [
      { ...threeSuggestions[0], votes: 0 },
      { ...threeSuggestions[1], votes: 5 },
      { ...threeSuggestions[2], votes: 0 },
    ]
    seedSuggestions(sorted)
    render(<App />)

    // Vote for Hanzo, which is rendered below Yuki due to sort order
    await userEvent.click(screen.getByRole('button', { name: /vote for hanzo/i }))

    // Only Hanzo should be toggled to voted state; Yuki and Kimi remain unvoted
    expect(screen.getByRole('button', { name: /remove vote for hanzo/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove vote for yuki/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove vote for kimi/i })).not.toBeInTheDocument()
  })
})

describe('voting', () => {
  it('increments vote count from 0 to 1 on first click', async () => {
    seedSuggestion()
    render(<App />)

    expect(getVoteCount()).toBe(0)

    await userEvent.click(getVoteButton())

    expect(getVoteCount()).toBe(1)
  })

  it('decrements vote count from 1 to 0 when revoking a vote', async () => {
    seedSuggestion({ ...testSuggestion, votes: 1 })
    seedVotedIds([testSuggestion.id])
    render(<App />)

    expect(getVoteCount()).toBe(1)

    const revokeButton = screen.getByRole('button', { name: /remove vote for rocket/i })
    await userEvent.click(revokeButton)

    expect(getVoteCount()).toBe(0)
  })

  it('prevents a second vote from the same browser session', async () => {
    seedSuggestion()
    render(<App />)

    await userEvent.click(getVoteButton())
    expect(getVoteCount()).toBe(1)

    // The button is now in "voted" state — clicking again revokes, not double-votes
    const revokeButton = screen.getByRole('button', { name: /remove vote for rocket/i })
    await userEvent.click(revokeButton)
    expect(getVoteCount()).toBe(0)

    // Vote again — still only 1, not 2
    await userEvent.click(getVoteButton())
    expect(getVoteCount()).toBe(1)
  })

  it('marks the vote button as already voted when localStorage has the suggestion id', async () => {
    seedSuggestion({ ...testSuggestion, votes: 1 })
    seedVotedIds([testSuggestion.id])
    render(<App />)

    // The button shows "remove vote" aria-label, meaning duplicate vote is blocked
    expect(screen.getByRole('button', { name: /remove vote for rocket/i })).toBeInTheDocument()
    expect(getVoteCount()).toBe(1)

    // Clicking once removes the vote rather than adding another
    await userEvent.click(screen.getByRole('button', { name: /remove vote for rocket/i }))
    expect(getVoteCount()).toBe(0)
  })
})
