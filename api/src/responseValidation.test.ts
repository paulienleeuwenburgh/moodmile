import { describe, expect, it } from 'vitest'
import { validateQuestion, validateResponse, type QuestionConfig } from './responseValidation'

const base = { allowSuggestions: false }

describe('typed question validation', () => {
  it.each([
    ['categorical-single', { options: ['Red', 'Blue'] }],
    ['categorical-multiple', { options: ['Red', 'Blue'] }],
    ['boolean', {}],
    ['ordinal', { options: ['Low', 'Medium', 'High'] }],
    ['numeric', { numericMin: 0, numericMax: 10 }],
    ['text', { allowVoting: true, allowSuggestions: true }],
  ])('accepts valid %s settings', (questionType, settings) => {
    expect(validateQuestion({ ...base, questionType, ...settings } as QuestionConfig)).toEqual([])
  })

  it('requires options for categorical and ordinal questions', () => {
    expect(validateQuestion({ ...base, questionType: 'categorical-single' })).toContain(
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
})

describe('typed response validation', () => {
  it.each([
    [{ questionType: 'categorical-single', options: ['Red', 'Blue'] }, 'Red', undefined],
    [{ questionType: 'categorical-single', options: ['Red', 'Blue'] }, 'Green', 'Choose one of the available options.'],
    [{ questionType: 'categorical-multiple', options: ['Red', 'Blue'] }, ['Red', 'Blue'], undefined],
    [{ questionType: 'categorical-multiple', options: ['Red', 'Blue'] }, ['Red', 'Red'], 'Choose one or more unique available options.'],
    [{ questionType: 'boolean' }, true, undefined],
    [{ questionType: 'boolean' }, 'true', 'Answer must be true or false.'],
    [{ questionType: 'ordinal', options: ['Low', 'Medium', 'High'] }, 'High', undefined],
    [{ questionType: 'numeric', numericMin: 1, numericMax: 5 }, 3.5, undefined],
    [{ questionType: 'numeric', numericMin: 1, numericMax: 5 }, 8, 'Answer must be no more than 5.'],
    [{ questionType: 'text' }, 'Good answer', undefined],
    [{ questionType: 'text' }, '<script>', 'Answers cannot contain angle brackets.'],
  ])('validates %j answer %j', (question, answer, expected) => {
    expect(validateResponse({ allowSuggestions: false, ...question } as QuestionConfig, answer)).toBe(expected)
  })
})
