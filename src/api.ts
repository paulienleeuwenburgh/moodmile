import type { Campaign, Question, Suggestion } from './types'

const BASE = '/api'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

export async function fetchCampaign(campaignId: string): Promise<Campaign> {
  return apiFetch<Campaign>(`/campaign?campaignId=${encodeURIComponent(campaignId)}`)
}

export async function fetchQuestions(campaignId: string): Promise<Question[]> {
  return apiFetch<Question[]>(`/questions?campaignId=${encodeURIComponent(campaignId)}`)
}

export async function fetchSuggestions(campaignId: string): Promise<Suggestion[]> {
  return apiFetch<Suggestion[]>(`/suggestions?campaignId=${encodeURIComponent(campaignId)}`)
}

export async function postSuggestion(
  campaignId: string,
  questionId: string,
  name: string,
): Promise<Suggestion | null> {
  try {
    return await apiFetch<Suggestion>('/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, questionId, name }),
    })
  } catch (err) {
    // 409 Conflict means duplicate — treat as a no-op
    if (err instanceof Error && err.message.includes('already exists')) {
      return null
    }
    throw err
  }
}

export async function fetchVoteCounts(
  campaignId: string,
  sessionId: string,
): Promise<Map<string, number>> {
  const counts = await apiFetch<Record<string, number>>(
    `/votes?campaignId=${encodeURIComponent(campaignId)}&sessionId=${encodeURIComponent(sessionId)}`,
  )
  return new Map(Object.entries(counts))
}

export async function postVote(
  campaignId: string,
  questionId: string,
  suggestionId: string,
  sessionId: string,
  revoke: boolean,
): Promise<Suggestion | null> {
  try {
    return await apiFetch<Suggestion>('/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, questionId, suggestionId, sessionId, revoke }),
    })
  } catch {
    return null
  }
}

// ─── Admin API ────────────────────────────────────────────────────────────────

function adminHeaders(adminSecret: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret }
}

export async function adminDeleteSuggestion(
  adminSecret: string,
  campaignId: string,
  questionId: string,
  suggestionId: string,
  deletedBy: string,
  deleteReason: string,
): Promise<void> {
  await apiFetch('/mgmt/suggestions', {
    method: 'DELETE',
    headers: adminHeaders(adminSecret),
    body: JSON.stringify({ campaignId, questionId, suggestionId, deletedBy, deleteReason }),
  })
}

export async function adminRestoreSuggestion(
  adminSecret: string,
  campaignId: string,
  questionId: string,
  suggestionId: string,
): Promise<void> {
  await apiFetch('/mgmt/suggestions/restore', {
    method: 'POST',
    headers: adminHeaders(adminSecret),
    body: JSON.stringify({ campaignId, questionId, suggestionId }),
  })
}

export async function adminResetVotes(adminSecret: string, campaignId: string): Promise<void> {
  await apiFetch(`/mgmt/campaigns/${encodeURIComponent(campaignId)}/votes`, {
    method: 'DELETE',
    headers: adminHeaders(adminSecret),
  })
}

export async function adminResetSuggestions(adminSecret: string, campaignId: string): Promise<void> {
  await apiFetch(`/mgmt/campaigns/${encodeURIComponent(campaignId)}/suggestions`, {
    method: 'DELETE',
    headers: adminHeaders(adminSecret),
  })
}

export async function adminFullReset(adminSecret: string, campaignId: string): Promise<void> {
  await apiFetch(`/mgmt/campaigns/${encodeURIComponent(campaignId)}/reset`, {
    method: 'POST',
    headers: adminHeaders(adminSecret),
  })
}

export async function fetchDeletedSuggestions(
  adminSecret: string,
  campaignId: string,
): Promise<(Suggestion & { deletedAt?: string; deletedBy?: string; deleteReason?: string })[]> {
  return apiFetch<(Suggestion & { deletedAt?: string; deletedBy?: string; deleteReason?: string })[]>(
    `/mgmt/suggestions?campaignId=${encodeURIComponent(campaignId)}`,
    { headers: { 'X-Admin-Secret': adminSecret } },
  )
}

