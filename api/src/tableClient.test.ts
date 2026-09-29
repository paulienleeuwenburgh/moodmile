import { describe, expect, it } from 'vitest'
import { entityToQuestion, type QuestionEntity } from './tableClient'

function questionEntity(values: Partial<QuestionEntity> = {}) {
  return {
    partitionKey: 'campaign-1',
    rowKey: 'question-1',
    title: 'Question',
    description: '',
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...values,
  } as never
}

describe('entityToQuestion defaults', () => {
  it('defaults Text properties for optional answers, suggestion length, and disabled voting', () => {
    const question = entityToQuestion(questionEntity({ questionType: 'text' }))
    expect(question).toMatchObject({
      required: false,
      maxSize: 250,
      numberOfVotes: 0,
      duplicateVotingAllowed: false,
    })
  })

  it('defaults Categorical to one selection with duplicates disabled', () => {
    const question = entityToQuestion(questionEntity({ questionType: 'categorical' }))
    expect(question).toMatchObject({
      required: false,
      numberOfVotes: 1,
      duplicateVotingAllowed: false,
    })
    expect(question.maxSize).toBeUndefined()
  })

  it('does not apply voting-only settings to other question types', () => {
    const question = entityToQuestion(questionEntity({ questionType: 'boolean' }))
    expect(question.numberOfVotes).toBeUndefined()
    expect(question.duplicateVotingAllowed).toBeUndefined()
  })
})
