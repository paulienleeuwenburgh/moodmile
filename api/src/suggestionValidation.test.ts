import { describe, expect, it } from 'vitest'
import { SUGGESTION_MAX_LENGTH, validateSuggestion } from './suggestionValidation'

describe('validateSuggestion', () => {
  it('accepts punctuation and quotation marks', () => {
    expect(validateSuggestion(`Hello, world! "Yes" & no? (Maybe): 50% + tax = ok / @home #1;`)).toBe('')
  })

  it('accepts emoji', () => {
    expect(validateSuggestion('Sunny 😊')).toBe('')
  })

  it('accepts accented characters', () => {
    expect(validateSuggestion('Café über niño')).toBe('')
  })

  it('accepts a 250-character submission', () => {
    expect(validateSuggestion('a'.repeat(SUGGESTION_MAX_LENGTH))).toBe('')
  })

  it('rejects submissions longer than 250 characters', () => {
    expect(validateSuggestion('a'.repeat(SUGGESTION_MAX_LENGTH + 1))).toBe(
      'Answers can be up to 250 characters long.',
    )
  })

  it('rejects script injection attempts', () => {
    expect(validateSuggestion('<script>alert("xss")</script>')).toBe(
      'Answers can include punctuation, quotation marks, emoji, and accented letters, but not angle brackets.',
    )
  })
})
