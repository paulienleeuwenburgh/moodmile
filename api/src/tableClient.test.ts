import { describe, expect, it } from 'vitest'
import { entityToQuestion, type QuestionEntity } from './tableClient'
import { validateQuestion } from './responseValidation'

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
      displaySubmissions: true,
    })
    expect(validateQuestion(question)).toEqual([])
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

  it('preserves question status from Azure Table Storage', () => {
    expect(entityToQuestion(questionEntity({ questionType: 'categorical', status: 'active' })).status).toBe('active')
  })

  it('does not apply voting-only settings to other question types', () => {
    const question = entityToQuestion(questionEntity({ questionType: 'boolean' }))
    expect(question.numberOfVotes).toBeUndefined()
    expect(question.duplicateVotingAllowed).toBeUndefined()
    expect(question.displaySubmissions).toBeUndefined()
  })

  it('normalizes displaySubmissions=false for Text questions', () => {
    const question = entityToQuestion(questionEntity({
      questionType: 'text',
      displaySubmissions: 'false' as unknown as boolean,
    }))
    expect(question.displaySubmissions).toBe(false)
  })

  it('normalizes Azure title-case question types and string-valued scalar properties', () => {
    const question = entityToQuestion(questionEntity({
      questionType: 'Text',
      allowSuggestions: 'true' as unknown as boolean,
      required: 'true' as unknown as boolean,
      maxSize: '80' as unknown as number,
      numberOfVotes: '2' as unknown as number,
      duplicateVotingAllowed: 'false' as unknown as boolean,
    }))

    expect(question).toMatchObject({
      questionType: 'text',
      allowSuggestions: true,
      required: true,
      maxSize: 80,
      numberOfVotes: 2,
      duplicateVotingAllowed: false,
    })
  })

  it('normalizes categorical title casing while preserving unknown types for validation', () => {
    expect(entityToQuestion(questionEntity({ questionType: 'Categorical' })).questionType).toBe('categorical')
    expect(entityToQuestion(questionEntity({ questionType: 'unknown' })).questionType).toBe('unknown')
  })
})
