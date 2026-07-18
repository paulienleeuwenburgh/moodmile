const VALID_CHARS_REGEX = /^[\p{L}\p{N} '-]*$/u

export function validateSuggestion(value: string): string {
  if (!VALID_CHARS_REGEX.test(value)) {
    return 'Only letters, numbers, spaces, apostrophes and hyphens are allowed.'
  }
  return ''
}
