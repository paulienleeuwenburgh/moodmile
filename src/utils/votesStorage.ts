const STORAGE_KEY = 'moodmile-votes-v1'

export function loadVotedIds(): Set<string> {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY)
    if (!storedValue) {
      return new Set()
    }

    const parsed = JSON.parse(storedValue)
    if (!Array.isArray(parsed)) {
      return new Set()
    }

    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

export function saveVotedIds(votedIds: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...votedIds]))
}
