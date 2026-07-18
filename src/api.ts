import type { Suggestion } from './types'

const BASE = '/api'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

export async function fetchSuggestions(): Promise<Suggestion[]> {
  return apiFetch<Suggestion[]>('/suggestions')
}

export async function postSuggestion(
  mascotId: string,
  name: string,
): Promise<Suggestion | null> {
  try {
    return await apiFetch<Suggestion>('/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mascotId, name }),
    })
  } catch (err) {
    // 409 Conflict means duplicate — treat as a no-op
    if (err instanceof Error && err.message.includes('already exists')) {
      return null
    }
    throw err
  }
}

export async function fetchVotedIds(sessionId: string): Promise<Set<string>> {
  const ids = await apiFetch<string[]>(`/votes?sessionId=${encodeURIComponent(sessionId)}`)
  return new Set(ids)
}

export async function postVote(
  suggestionId: string,
  sessionId: string,
  revoke: boolean,
): Promise<Suggestion | null> {
  try {
    return await apiFetch<Suggestion>('/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestionId, sessionId, revoke }),
    })
  } catch {
    return null
  }
}
