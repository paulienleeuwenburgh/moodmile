import { describe, expect, it } from 'vitest'
import { validateQuestion, validateResponse, type QuestionConfig } from './responseValidation'

const base = { allowSuggestions: false }

describe('typed question validation', () => {
  it.each([
    ['categorical', { options: ['Red', 'Blue'] }],
    ['boolean', {}],
    ['ordinal', { options: ['Low', 'Medium', 'High'] }],
    ['numeric', { numericMin: 0, numericMax: 10 }],
    ['text', { numberOfVotes: 1, allowSuggestions: true }],
  ])('accepts valid %s settings', (questionType, settings) => {
    expect(validateQuestion({ ...base, questionType, ...settings } as QuestionConfig)).toEqual([])
  })

  it('requires options for categorical and ordinal questions', () => {
    expect(validateQuestion({ ...base, questionType: 'categorical' })).toContain(
      'This question type requires at least two non-empty options.',
    )
  })

  it('rejects unsupported per-type settings and reversed numeric bounds', () => {
    expect(validateQuestion({
      ...base,
      questionType: 'boolean',
      options: ['Yes', 'No'],
      numericMin: 1,
    })).toEqual([
      'Options are only supported for categorical and ordinal questions.',
      'Numeric bounds are only supported for numeric questions.',
    ])
    expect(validateQuestion({
      ...base,
      questionType: 'numeric',
      numericMin: 10,
      numericMax: 1,
    })).toContain('numericMin cannot exceed numericMax.')
  })

  it('validates question-specific setting types and ranges', () => {
    expect(validateQuestion({ ...base, questionType: 'text', required: 'yes' } as unknown as QuestionConfig))
      .toContain('required must be a boolean.')
    expect(validateQuestion({ ...base, questionType: 'text', maxSize: 0 })).toContain('maxSize must be a positive integer.')
    expect(validateQuestion({ ...base, questionType: 'text', numberOfVotes: -1 }))
      .toContain('numberOfVotes must be a non-negative integer.')
    expect(validateQuestion({ ...base, questionType: 'categorical', numberOfVotes: 0, options: ['Red', 'Blue'] }))
      .toContain('numberOfVotes must be a positive integer for categorical questions.')
    expect(validateQuestion({ ...base, questionType: 'boolean', allowSuggestions: true }))
      .toContain('allowSuggestions is only supported for text questions.')
  })

  it('validates displaySubmissions type and applicability', () => {
    expect(validateQuestion({ ...base, questionType: 'text', displaySubmissions: 'yes' } as unknown as QuestionConfig))
      .toContain('displaySubmissions must be a boolean.')
    expect(validateQuestion({ ...base, questionType: 'boolean', displaySubmissions: false }))
      .toContain('displaySubmissions is only supported for text questions.')
    expect(validateQuestion({ ...base, questionType: 'text', displaySubmissions: false })).toEqual([])
  })
})

describe('typed response validation', () => {
  it.each([
    [{ questionType: 'categorical', options: ['Red', 'Blue'] }, ['Red'], undefined],
    [{ questionType: 'categorical', options: ['Red', 'Blue'] }, ['Red', 'Blue'], 'Choose up to 1 available option without duplicates.'],
    [{ questionType: 'categorical', options: ['Red', 'Blue'], numberOfVotes: 2 }, ['Red', 'Blue'], undefined],
    [{ questionType: 'categorical', options: ['Red', 'Blue'], numberOfVotes: 2 }, ['Red', 'Red'], 'Choose up to 2 available options without duplicates.'],
    [{ questionType: 'categorical', options: ['Red', 'Blue'], numberOfVotes: 2, duplicateVotingAllowed: true }, ['Red', 'Red'], undefined],
    [{ questionType: 'boolean' }, true, undefined],
    [{ questionType: 'boolean' }, 'true', 'Answer must be true or false.'],
    [{ questionType: 'ordinal', options: ['Low', 'Medium', 'High'] }, 'High', undefined],
    [{ questionType: 'numeric', numericMin: 1, numericMax: 5 }, 3.5, undefined],
    [{ questionType: 'numeric', numericMin: 1, numericMax: 5 }, 8, 'Answer must be no more than 5.'],
    [{ questionType: 'text' }, 'Good answer', undefined],
    [{ questionType: 'text', maxSize: 4 }, 'Good answer', 'Answers can be up to 4 characters long.'],
    [{ questionType: 'text' }, '<script>', 'Answers cannot contain angle brackets.'],
  ])('validates %j answer %j', (question, answer, expected) => {
    expect(validateResponse({ allowSuggestions: false, ...question } as QuestionConfig, answer)).toBe(expected)
  })

  it('accepts unanswered optional questions and rejects unanswered required questions', () => {
    expect(validateResponse({ questionType: 'boolean', required: false, allowSuggestions: false }, undefined)).toBeUndefined()
    expect(validateResponse({ questionType: 'boolean', required: true, allowSuggestions: false }, undefined)).toBe('An answer is required.')
  })
})
