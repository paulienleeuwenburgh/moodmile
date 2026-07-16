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
