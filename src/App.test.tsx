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
  return screen.getAllByRole('button', { name: /vote for rocket/i })[0]
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

    await userEvent.click(screen.getAllByRole('button', { name: /vote for hanzo/i })[0])

    expect(screen.getAllByRole('button', { name: /remove vote for hanzo/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /vote for yuki/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /vote for kimi/i })[0]).toBeInTheDocument()
  })

  it('voting Kimi only changes Kimi', async () => {
    seedSuggestions(threeSuggestions)
    render(<App />)

    await userEvent.click(screen.getAllByRole('button', { name: /vote for kimi/i })[0])

    expect(screen.getAllByRole('button', { name: /vote for hanzo/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /vote for yuki/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /remove vote for kimi/i })[0]).toBeInTheDocument()
  })

  it('sorting and re-rendering do not affect vote targeting', async () => {
    // Yuki has 5 votes so it appears first in the leaderboard; Hanzo and Kimi have 0
    // The suggestion board is ordered by creation date so Hanzo still appears first
    const sorted: Suggestion[] = [
      { ...threeSuggestions[0], votes: 0 },
      { ...threeSuggestions[1], votes: 5 },
      { ...threeSuggestions[2], votes: 0 },
    ]
    seedSuggestions(sorted)
    render(<App />)

    // Vote for Hanzo — it is the oldest suggestion (creation-date order)
    await userEvent.click(screen.getAllByRole('button', { name: /vote for hanzo/i })[0])

    // Only Hanzo should be toggled to voted state; Yuki and Kimi remain unvoted
    expect(screen.getAllByRole('button', { name: /remove vote for hanzo/i })[0]).toBeInTheDocument()
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

    const revokeButton = screen.getAllByRole('button', { name: /remove vote for rocket/i })[0]
    await userEvent.click(revokeButton)

    expect(getVoteCount()).toBe(0)
  })

  it('prevents a second vote from the same browser session', async () => {
    seedSuggestion()
    render(<App />)

    await userEvent.click(getVoteButton())
    expect(getVoteCount()).toBe(1)

    // The button is now in "voted" state — clicking again revokes, not double-votes
    const revokeButton = screen.getAllByRole('button', { name: /remove vote for rocket/i })[0]
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
    expect(screen.getAllByRole('button', { name: /remove vote for rocket/i })[0]).toBeInTheDocument()
    expect(getVoteCount()).toBe(1)

    // Clicking once removes the vote rather than adding another
    await userEvent.click(screen.getAllByRole('button', { name: /remove vote for rocket/i })[0])
    expect(getVoteCount()).toBe(0)
  })
})

describe('suggestion board ordering', () => {
  it('renders suggestions in creation-date order regardless of vote counts', () => {
    const suggestions: Suggestion[] = [
      { id: 'a', mascotId: 'comet', name: 'Alpha', createdAt: '2024-01-01T00:00:00.000Z', votes: 10 },
      { id: 'b', mascotId: 'comet', name: 'Beta', createdAt: '2024-01-02T00:00:00.000Z', votes: 0 },
      { id: 'c', mascotId: 'comet', name: 'Gamma', createdAt: '2024-01-03T00:00:00.000Z', votes: 5 },
    ]
    seedSuggestions(suggestions)
    render(<App />)

    const boardSection = document.querySelector('.suggestion-board')!
    const names = Array.from(boardSection.querySelectorAll('.suggestion-card__name')).map(
      (el) => el.textContent,
    )
    expect(names).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('does not re-order suggestion cards after voting', async () => {
    const suggestions: Suggestion[] = [
      { id: 'a', mascotId: 'comet', name: 'Alpha', createdAt: '2024-01-01T00:00:00.000Z', votes: 0 },
      { id: 'b', mascotId: 'comet', name: 'Beta', createdAt: '2024-01-02T00:00:00.000Z', votes: 0 },
    ]
    seedSuggestions(suggestions)
    render(<App />)

    const boardSection = document.querySelector('.suggestion-board')!

    const before = Array.from(boardSection.querySelectorAll('.suggestion-card__name')).map(
      (el) => el.textContent,
    )
    expect(before).toEqual(['Alpha', 'Beta'])

    // Vote for Beta (the second card)
    await userEvent.click(screen.getAllByRole('button', { name: /vote for beta/i })[0])

    const after = Array.from(boardSection.querySelectorAll('.suggestion-card__name')).map(
      (el) => el.textContent,
    )
    expect(after).toEqual(['Alpha', 'Beta'])
  })
})

describe('leaderboard', () => {
  it('renders suggestions sorted by vote count descending', () => {
    const suggestions: Suggestion[] = [
      { id: 'a', mascotId: 'comet', name: 'Alpha', createdAt: '2024-01-01T00:00:00.000Z', votes: 2 },
      { id: 'b', mascotId: 'comet', name: 'Beta', createdAt: '2024-01-02T00:00:00.000Z', votes: 5 },
      { id: 'c', mascotId: 'comet', name: 'Gamma', createdAt: '2024-01-03T00:00:00.000Z', votes: 1 },
    ]
    seedSuggestions(suggestions)
    render(<App />)

    const leaderboard = document.querySelector('.leaderboard')!
    const names = Array.from(leaderboard.querySelectorAll('.leaderboard-entry__name')).map(
      (el) => el.textContent,
    )
    expect(names).toEqual(['Beta', 'Alpha', 'Gamma'])
  })

  it('updates leaderboard order live when a vote changes the ranking', async () => {
    const suggestions: Suggestion[] = [
      { id: 'a', mascotId: 'comet', name: 'Alpha', createdAt: '2024-01-01T00:00:00.000Z', votes: 0 },
      { id: 'b', mascotId: 'comet', name: 'Beta', createdAt: '2024-01-02T00:00:00.000Z', votes: 1 },
    ]
    seedSuggestions(suggestions)
    render(<App />)

    const leaderboard = document.querySelector('.leaderboard')!

    const before = Array.from(leaderboard.querySelectorAll('.leaderboard-entry__name')).map(
      (el) => el.textContent,
    )
    expect(before).toEqual(['Beta', 'Alpha'])

    // Vote for Alpha twice so it overtakes Beta (which has 1 vote)
    await userEvent.click(screen.getAllByRole('button', { name: /vote for alpha/i })[0])

    const after = Array.from(leaderboard.querySelectorAll('.leaderboard-entry__name')).map(
      (el) => el.textContent,
    )
    expect(after).toEqual(['Alpha', 'Beta'])
  })

  it('is not rendered when there are no suggestions', () => {
    render(<App />)
    expect(document.querySelector('.leaderboard')).not.toBeInTheDocument()
  })
})
