export const SUGGESTION_MAX_LENGTH = 250

const INVALID_MARKUP_REGEX = /[<>]/u

function countSuggestionCharacters(value: string): number {
  return Array.from(value).length
}

export function validateSuggestion(value: string): string {
  if (countSuggestionCharacters(value) > SUGGESTION_MAX_LENGTH) {
    return `Answers can be up to ${SUGGESTION_MAX_LENGTH} characters long.`
  }

  if (INVALID_MARKUP_REGEX.test(value)) {
    return 'Answers can include punctuation, quotation marks, emoji, and accented letters, but not angle brackets.'
  }

  return ''
}
