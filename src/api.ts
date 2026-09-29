import type { AdminCampaignSummary, Campaign, ExportFormat, Question, QuestionResponse, Suggestion } from './types'

const BASE = '/api'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function apiFetchResponse(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${BASE}${path}`, init)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, (body as { error?: string }).error ?? `HTTP ${response.status}`)
  }
  return response
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetchResponse(path, init)
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

export async function fetchQuestionResponses(campaignId: string): Promise<QuestionResponse[]> {
  return apiFetch<QuestionResponse[]>(`/responses?campaignId=${encodeURIComponent(campaignId)}`)
}

export async function postQuestionResponse(
  campaignId: string,
  questionId: string,
  answer: QuestionResponse['answer'],
  sessionId: string,
): Promise<void> {
  await apiFetch('/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId, questionId, answer, sessionId }),
  })
}

export async function postSuggestion(
  campaignId: string,
  questionId: string,
  name: string,
  sessionId: string,
): Promise<Suggestion | null> {
  try {
    return await apiFetch<Suggestion>('/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, questionId, name, sessionId }),
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
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
  return apiFetch<Suggestion>('/votes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId, questionId, suggestionId, sessionId, revoke }),
  })
}

// ─── Admin API ────────────────────────────────────────────────────────────────

function adminHeaders(adminSecret: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret }
}

function decodeLatin1PercentEncoded(value: string): string {
  return value.replace(/%([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
}

function getDownloadFileName(contentDisposition: string, fallback: string): string {
  const fileNameStarMatch = contentDisposition.match(/filename\*\s*=\s*([^;]+)/i)
  if (fileNameStarMatch) {
    const rawValue = fileNameStarMatch[1]?.trim()
    const starValue = rawValue?.replace(/^"|"$/g, '')
    const rfc5987Match = starValue?.match(/^([^']*)'[^']*'(.*)$/)
    if (rfc5987Match) {
      const [, charset, encodedValue] = rfc5987Match
      if (charset.toLowerCase() === 'iso-8859-1') {
        return decodeLatin1PercentEncoded(encodedValue)
      }
      try {
        return decodeURIComponent(encodedValue)
      } catch {
        return encodedValue
      }
    }
    if (starValue) return starValue
  }

  const fileNameMatch = contentDisposition.match(/filename\s*=\s*("?)([^";]+)\1/i)
  return fileNameMatch?.[2]?.trim() || fallback
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

export async function fetchAdminCampaignSummary(
  adminSecret: string,
  campaignId: string,
): Promise<AdminCampaignSummary> {
  return apiFetch<AdminCampaignSummary>(
    `/mgmt/campaigns/${encodeURIComponent(campaignId)}/summary`,
    { headers: { 'X-Admin-Secret': adminSecret } },
  )
}

export async function adminDownloadCampaignExport(
  adminSecret: string,
  campaignId: string,
  format: ExportFormat,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await apiFetchResponse(
    `/mgmt/campaigns/${encodeURIComponent(campaignId)}/export?format=${encodeURIComponent(format)}`,
    { headers: { 'X-Admin-Secret': adminSecret } },
  )
  const contentDisposition = response.headers.get('Content-Disposition') ?? ''
  const fileName = getDownloadFileName(contentDisposition, `${campaignId}-export.json`)
  return {
    blob: await response.blob(),
    fileName,
  }
}
