const SESSION_ID_KEY = 'moodmile-session-id'

export function getSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_ID_KEY)
  if (!sessionId) {
    sessionId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(SESSION_ID_KEY, sessionId)
  }
  return sessionId
}
