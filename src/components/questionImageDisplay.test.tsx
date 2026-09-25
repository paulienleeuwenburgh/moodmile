import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Leaderboard } from './Leaderboard'
import { SuggestionBoard } from './SuggestionBoard'
import type { Campaign, Question, Suggestion } from '../types'

const campaign: Campaign = {
  id: 'campaign-1',
  title: 'Campaign',
  description: 'Description',
  status: 'active',
  createdAt: '2024-01-01T00:00:00.000Z',
  allowSuggestions: false,
  maxVotesTotal: 1,
  maxVotesPerCategory: 1,
  maxVotesPerCandidate: 1,
}

const onVote = vi.fn()

function createQuestion(id: string): Question {
  return {
    id,
    campaignId: campaign.id,
    title: `Question ${id}`,
    description: 'Description',
    imageUrl: `/images/${id}.png`,
    sortOrder: 1,
  }
}

function createSuggestion(questionId: string, id = `${questionId}-suggestion`): Suggestion {
  return {
    id,
    campaignId: campaign.id,
    questionId,
    name: `Suggestion ${id}`,
    createdAt: '2024-01-01T00:00:00.000Z',
    votes: 1,
  }
}

describe('question image display', () => {
  it('hides submission board images when there is only one question', () => {
    const question = createQuestion('question-1')
    const { container } = render(
      <SuggestionBoard
        campaign={campaign}
        questions={[question]}
        suggestions={[createSuggestion(question.id)]}
        voteCountById={new Map()}
        onVote={onVote}
      />,
    )

    expect(container.querySelector('.suggestion-group img')).not.toBeInTheDocument()
  })

  it('shows submission board images when there are multiple questions', () => {
    const firstQuestion = createQuestion('question-1')
    const secondQuestion = createQuestion('question-2')
    const { container } = render(
      <SuggestionBoard
        campaign={campaign}
        questions={[firstQuestion, secondQuestion]}
        suggestions={[createSuggestion(firstQuestion.id), createSuggestion(secondQuestion.id)]}
        voteCountById={new Map()}
        onVote={onVote}
      />,
    )

    expect(container.querySelectorAll('.suggestion-group img')).toHaveLength(2)
  })

  it('hides leaderboard images when there is only one question', () => {
    const question = createQuestion('question-1')
    const { container } = render(
      <Leaderboard
        campaign={campaign}
        questions={[question]}
        suggestions={[createSuggestion(question.id)]}
        voteCountById={new Map()}
        onVote={onVote}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeInTheDocument()
    expect(container.querySelector('.leaderboard-entry img')).not.toBeInTheDocument()
  })

  it('shows leaderboard images when there are multiple questions', () => {
    const firstQuestion = createQuestion('question-1')
    const secondQuestion = createQuestion('question-2')
    const { container } = render(
      <Leaderboard
        campaign={campaign}
        questions={[firstQuestion, secondQuestion]}
        suggestions={[createSuggestion(firstQuestion.id), createSuggestion(secondQuestion.id)]}
        voteCountById={new Map()}
        onVote={onVote}
      />,
    )

    expect(container.querySelectorAll('.leaderboard-entry img')).toHaveLength(2)
  })
})
