import { describe, expect, it } from 'vitest'
import { shouldDisplayAllSubmissions } from './suggestionVisibility'

describe('shouldDisplayAllSubmissions', () => {
  it('returns true for non-text question types', () => {
    expect(shouldDisplayAllSubmissions({ questionType: 'boolean' })).toBe(true)
  })

  it('defaults to true when displaySubmissions is unset', () => {
    expect(shouldDisplayAllSubmissions({ questionType: 'text' })).toBe(true)
  })

  it('returns false when displaySubmissions=false and voting is disabled', () => {
    expect(shouldDisplayAllSubmissions({ questionType: 'text', displaySubmissions: false, numberOfVotes: 0 }))
      .toBe(false)
  })

  it('overrules displaySubmissions=false to true when voting is enabled', () => {
    expect(shouldDisplayAllSubmissions({ questionType: 'text', displaySubmissions: false, numberOfVotes: 1 }))
      .toBe(true)
  })

  it('returns true when displaySubmissions=true regardless of voting', () => {
    expect(shouldDisplayAllSubmissions({ questionType: 'text', displaySubmissions: true, numberOfVotes: 0 }))
      .toBe(true)
  })
})
