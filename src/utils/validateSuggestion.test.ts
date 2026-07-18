import { describe, expect, it } from 'vitest'
import { validateSuggestion } from './validateSuggestion'

describe('validateSuggestion', () => {
  it('returns empty string for valid input with letters', () => {
    expect(validateSuggestion('Sunny Stride')).toBe('')
  })

  it('returns empty string for input with numbers', () => {
    expect(validateSuggestion('R2D2')).toBe('')
  })

  it('returns empty string for input with apostrophe', () => {
    expect(validateSuggestion("O'Brien")).toBe('')
  })

  it('returns empty string for input with hyphen', () => {
    expect(validateSuggestion('Spider-Man')).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(validateSuggestion('')).toBe('')
  })

  it('returns error for emoji', () => {
    expect(validateSuggestion('Sunny 😊')).not.toBe('')
  })

  it('returns error for emoji-only input', () => {
    expect(validateSuggestion('🚀')).not.toBe('')
  })

  it('returns error for @ symbol', () => {
    expect(validateSuggestion('user@name')).not.toBe('')
  })

  it('returns error for # symbol', () => {
    expect(validateSuggestion('tag#1')).not.toBe('')
  })

  it('returns error for exclamation mark', () => {
    expect(validateSuggestion('Wow!')).not.toBe('')
  })

  it('returns error for dollar sign', () => {
    expect(validateSuggestion('$money')).not.toBe('')
  })
})
