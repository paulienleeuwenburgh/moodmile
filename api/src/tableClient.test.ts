import { describe, expect, it } from 'vitest'
import { entityToCampaignConfig, entityToQuestion, type CampaignEntity, type QuestionEntity } from './tableClient'
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

function campaignEntity(values: Partial<CampaignEntity> = {}) {
  return {
    partitionKey: 'campaign',
    rowKey: 'campaign-1',
    title: 'Campaign',
    description: '',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...values,
  } as never
}

describe('entityToCampaignConfig defaults', () => {
  it('defaults missing vote-budget fields to unlimited (0) instead of undefined', () => {
    const campaign = entityToCampaignConfig(campaignEntity())
    expect(campaign).toMatchObject({
      maxVotesTotal: 0,
      maxVotesPerCategory: 0,
      maxVotesPerCandidate: 0,
    })
  })

  it('preserves explicit vote-budget values', () => {
    const campaign = entityToCampaignConfig(campaignEntity({
      maxVotesTotal: 4,
      maxVotesPerCategory: 1,
      maxVotesPerCandidate: 1,
    }))
    expect(campaign).toMatchObject({
      maxVotesTotal: 4,
      maxVotesPerCategory: 1,
      maxVotesPerCandidate: 1,
    })
  })
})

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

  it('treats blank numericMin/numericMax strings as unset, not as "0" or ""', () => {
    // Azure Table Storage (e.g. via the Portal's "Edit entity" UI) can store an
    // intentionally-blank field as an empty string rather than omitting the property.
    // For a non-numeric question this must not be mistaken for an actual numeric bound,
    // which would otherwise fail validation and cause the question to be hidden entirely.
    const question = entityToQuestion(questionEntity({
      questionType: 'text',
      numericMin: '' as unknown as number,
      numericMax: '' as unknown as number,
    }))
    expect(question.numericMin).toBeUndefined()
    expect(question.numericMax).toBeUndefined()
    expect(validateQuestion(question)).toEqual([])
  })
})
