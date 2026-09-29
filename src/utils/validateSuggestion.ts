export const SUGGESTION_MAX_LENGTH = 250

const INVALID_MARKUP_REGEX = /[<>]/u

export function countSuggestionCharacters(value: string): number {
  return Array.from(value).length
}

export function validateSuggestion(value: string, maxLength = SUGGESTION_MAX_LENGTH): string {
  if (countSuggestionCharacters(value) > maxLength) {
    return `Answers can be up to ${maxLength} characters long.`
  }

  if (INVALID_MARKUP_REGEX.test(value)) {
    return 'Answers can include punctuation, quotation marks, emoji, and accented letters, but not angle brackets.'
  }

  return ''
}
