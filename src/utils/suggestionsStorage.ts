import type { Suggestion } from '../types'

const STORAGE_KEY = 'moodmile-suggestions-v1'

export function loadSuggestions(): Suggestion[] {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY)
    if (!storedValue) {
      return []
    }

    const parsed = JSON.parse(storedValue)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (item): item is Suggestion =>
        typeof item?.id === 'string' &&
        typeof item?.mascotId === 'string' &&
        typeof item?.name === 'string' &&
        typeof item?.createdAt === 'string',
    )
  } catch {
    return []
  }
}

export function saveSuggestions(suggestions: Suggestion[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(suggestions))
}
