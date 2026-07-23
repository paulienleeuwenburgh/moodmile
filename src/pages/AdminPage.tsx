import { useState } from 'react'
import type { Campaign, Question, Suggestion } from '../types'
import {
  fetchCampaign,
  fetchQuestions,
  fetchSuggestions,
  fetchDeletedSuggestions,
  adminDeleteSuggestion,
  adminRestoreSuggestion,
  adminResetVotes,
  adminResetSuggestions,
  adminFullReset,
} from '../api'

interface DeletedSuggestion extends Suggestion {
  deletedAt?: string
  deletedBy?: string
  deleteReason?: string
}

interface ConfirmDialog {
  title: string
  message: string
  confirmLabel?: string
  /** If provided, the confirm button is disabled until the user types this exact string. */
  confirmText?: string
  /** Set to false for non-destructive confirmations (e.g. restore). Defaults to true. */
  isDangerous?: boolean
  onConfirm: () => void
}

/**
 * Maps API error messages and network errors to human-readable messages for the admin UI.
 * The API throws Error instances with message = the server's error field, or "HTTP {status}".
 */
function getAdminErrorMessage(err: unknown, fallback = 'Operation failed.'): string {
  if (!(err instanceof Error)) return fallback
  const msg = err.message
  if (msg === 'Unauthorized') {
    return 'Invalid admin secret. Please check your credentials and try again.'
  }
  if (msg.includes('not configured')) {
    return 'Admin access is not configured on this server. Contact your administrator.'
  }
  if (msg.includes('Campaign not found')) {
    return 'Campaign not found. Please check the Campaign ID and try again.'
  }
  if (msg.startsWith('HTTP 5')) {
    return 'Unexpected server error. Please try again later.'
  }
  if (msg.startsWith('HTTP')) {
    return `API error: ${msg}. Please try again.`
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
    return 'API unavailable. Please check your connection and try again.'
  }
  return msg || fallback
}

export function AdminPage() {
  const [secret, setSecret] = useState('')
  const [campaignId, setCampaignId] = useState('ninja-naming')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [deletedSuggestions, setDeletedSuggestions] = useState<DeletedSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null)
  const [confirmInputValue, setConfirmInputValue] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const [deletedBy, setDeletedBy] = useState('')

  const questionById = Object.fromEntries(questions.map((q) => [q.id, q]))
  const totalVotes = [...suggestions, ...deletedSuggestions].reduce((sum, s) => sum + s.votes, 0)
  const canConfirm = !confirm?.confirmText || confirmInputValue === confirm.confirmText

  function showSuccess(msg: string) {
    setSuccessMessage(msg)
    setError('')
    setTimeout(() => setSuccessMessage(''), 6000)
  }

  function showError(msg: string) {
    setError(msg)
    setSuccessMessage('')
  }

  function logout() {
    setSecret('')
    setCampaign(null)
    setQuestions([])
    setSuggestions([])
    setDeletedSuggestions([])
    setIsAuthenticated(false)
    setError('')
    setSuccessMessage('')
    setConfirm(null)
    setConfirmInputValue('')
  }

  async function loadCampaign() {
    if (!secret.trim()) {
      showError('Please enter the admin secret.')
      return
    }
    if (!campaignId.trim()) {
      showError('Please enter a Campaign ID.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const id = campaignId.trim()
      const [c, q, s, d] = await Promise.all([
        fetchCampaign(id),
        fetchQuestions(id),
        fetchSuggestions(id),
        fetchDeletedSuggestions(secret.trim(), id),
      ])
      setCampaign(c)
      setQuestions(q)
      setSuggestions(s)
      setDeletedSuggestions(d)
      setIsAuthenticated(true)
      setError('')
    } catch (err) {
      showError(getAdminErrorMessage(err, 'Failed to load campaign.'))
      setCampaign(null)
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  async function refresh() {
    if (!campaign) return
    try {
      const [s, d] = await Promise.all([
        fetchSuggestions(campaignId),
        fetchDeletedSuggestions(secret, campaignId),
      ])
      setSuggestions(s)
      setDeletedSuggestions(d)
    } catch (err) {
      console.error('Failed to refresh campaign data:', err)
    }
  }

  function ask(dialog: ConfirmDialog) {
    setConfirmInputValue('')
    setConfirm(dialog)
  }

  async function handleDeleteSuggestion(suggestion: Suggestion) {
    const questionTitle = questionById[suggestion.questionId]?.title ?? suggestion.questionId
    ask({
      title: 'Delete candidate',
      message: `Delete "${suggestion.name}" from "${questionTitle}"?\n\nThe candidate will be immediately hidden from voting and rankings. Existing votes (${suggestion.votes}) are preserved for audit, and the affected voters regain that budget while the candidate remains deleted. Restoring the candidate makes those preserved votes count again.`,
      confirmLabel: 'Delete candidate',
      onConfirm: async () => {
        setConfirm(null)
        try {
          await adminDeleteSuggestion(
            secret,
            suggestion.campaignId,
            suggestion.questionId,
            suggestion.id,
            deletedBy,
            deleteReason,
          )
          showSuccess(`"${suggestion.name}" has been deleted. Existing votes are preserved and the candidate can be restored.`)
          setDeleteReason('')
          await refresh()
        } catch (err) {
          showError(getAdminErrorMessage(err, 'Delete failed.'))
        }
      },
    })
  }

  async function handleRestoreSuggestion(suggestion: DeletedSuggestion) {
    const questionTitle = questionById[suggestion.questionId]?.title ?? suggestion.questionId
    ask({
      title: 'Restore candidate',
      message: `Restore "${suggestion.name}" to "${questionTitle}"?\n\nThe candidate will immediately reappear in voting and rankings with its original vote count (${suggestion.votes}). Voting resumes as normal.`,
      confirmLabel: 'Restore candidate',
      isDangerous: false,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await adminRestoreSuggestion(secret, suggestion.campaignId, suggestion.questionId, suggestion.id)
          showSuccess(`"${suggestion.name}" has been restored and is now visible to voters with ${suggestion.votes} vote${suggestion.votes !== 1 ? 's' : ''}.`)
          await refresh()
        } catch (err) {
          showError(getAdminErrorMessage(err, 'Restore failed.'))
        }
      },
    })
  }

  async function handleResetVotes() {
    ask({
      title: 'Reset all votes',
      message: `Reset all votes for "${campaign?.title}"?\n\nAffects: Every vote record for this campaign will be deleted and all vote counts reset to 0.\n\nPreserved: All candidates (active and deleted) remain intact. Campaign settings are unchanged.\n\nThis cannot be undone.`,
      confirmLabel: 'Reset votes',
      onConfirm: async () => {
        setConfirm(null)
        try {
          await adminResetVotes(secret, campaignId)
          showSuccess(`All votes for "${campaign?.title}" have been reset to zero. All candidates are preserved.`)
          await refresh()
        } catch (err) {
          showError(getAdminErrorMessage(err, 'Vote reset failed.'))
        }
      },
    })
  }

  async function handleResetSuggestions() {
    const activeCount = suggestions.length
    ask({
      title: 'Reset all candidates',
      message: `Reset all candidates for "${campaign?.title}"?\n\nAffects: All ${activeCount} active candidate${activeCount !== 1 ? 's' : ''} will be soft-deleted. All votes will be permanently deleted.\n\nPreserved: Soft-deleted candidates are kept in storage and can be restored individually. Campaign settings are unchanged.\n\nVotes cannot be recovered after this action.`,
      confirmLabel: 'Reset candidates',
      onConfirm: async () => {
        setConfirm(null)
        try {
          await adminResetSuggestions(secret, campaignId)
          showSuccess(`All ${activeCount} active candidate${activeCount !== 1 ? 's' : ''} have been soft-deleted and all votes removed. Candidates can be restored individually.`)
          await refresh()
        } catch (err) {
          showError(getAdminErrorMessage(err, 'Candidate reset failed.'))
        }
      },
    })
  }

  async function handleFullReset() {
    ask({
      title: '⚠️ Full campaign reset',
      message: `This is the most destructive action available for "${campaign?.title}".\n\nAffects: ALL votes will be permanently deleted. ALL active candidates will be soft-deleted.\n\nPreserved: Campaign settings (title, status, voting rules) are untouched. Soft-deleted candidates can be restored individually — votes cannot be recovered.\n\nTo confirm, type the campaign ID below.`,
      confirmText: campaignId,
      confirmLabel: 'Full reset',
      onConfirm: async () => {
        setConfirm(null)
        setConfirmInputValue('')
        try {
          await adminFullReset(secret, campaignId)
          showSuccess(`Full reset complete for "${campaign?.title}". All votes deleted and all candidates soft-deleted. Campaign settings are preserved.`)
          await refresh()
        } catch (err) {
          showError(getAdminErrorMessage(err, 'Full reset failed.'))
        }
      },
    })
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="hero__eyebrow">MOODMILE</p>
        <h1>Admin Panel</h1>
        <p>Manage campaigns, candidates, and votes. All destructive actions require confirmation.</p>
      </section>

      {/* ── Global feedback messages ──────────────────────────────────────── */}
      {error && (
        <p className="admin-feedback admin-feedback--error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="admin-feedback__dismiss"
            aria-label="Dismiss error"
            onClick={() => setError('')}
          >×</button>
        </p>
      )}
      {successMessage && (
        <p className="admin-feedback admin-feedback--success" role="status">
          <span>{successMessage}</span>
          <button
            type="button"
            className="admin-feedback__dismiss"
            aria-label="Dismiss"
            onClick={() => setSuccessMessage('')}
          >×</button>
        </p>
      )}

      {/* ── Auth form (unauthenticated) ────────────────────────────────────── */}
      {!isAuthenticated && (
        <section className="admin-section">
          <h2>Access</h2>
          <div className="admin-form">
            <label htmlFor="admin-secret">Admin secret</label>
            <input
              id="admin-secret"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadCampaign() }}
              placeholder="Enter admin secret"
              autoComplete="current-password"
            />
            <label htmlFor="campaign-id">Campaign ID</label>
            <input
              id="campaign-id"
              type="text"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadCampaign() }}
              placeholder="e.g. ninja-naming"
            />
            <button type="button" onClick={loadCampaign} disabled={loading} className="admin-btn">
              {loading ? 'Loading…' : 'Load campaign'}
            </button>
          </div>
        </section>
      )}

      {/* ── Auth status bar (authenticated) ───────────────────────────────── */}
      {isAuthenticated && campaign && (
        <section className="admin-section admin-section--auth">
          <div className="admin-auth-bar">
            <div className="admin-auth-bar__status">
              <span className="admin-auth-badge" aria-hidden="true">✓</span>
              <span className="admin-auth-bar__label">Admin access granted</span>
            </div>
            <div className="admin-auth-bar__campaign">
              <span className="admin-auth-bar__campaign-title">{campaign.title}</span>
              <span className="admin-auth-bar__campaign-id">({campaignId})</span>
            </div>
            <button type="button" className="admin-btn admin-btn--sm admin-btn--logout" onClick={logout}>
              Logout
            </button>
          </div>
        </section>
      )}

      {campaign && isAuthenticated && (
        <>
          {/* ── Campaign summary ───────────────────────────────────────────── */}
          <section className="admin-section">
            <h2>Campaign summary</h2>
            <div className="admin-summary-grid">
              <div className="admin-summary-card">
                <span className="admin-summary-card__value admin-summary-card__value--status">{campaign.status}</span>
                <span className="admin-summary-card__label">Status</span>
              </div>
              <div className="admin-summary-card">
                <span className="admin-summary-card__value">{suggestions.length}</span>
                <span className="admin-summary-card__label">Active candidates</span>
              </div>
              <div className={`admin-summary-card${deletedSuggestions.length > 0 ? ' admin-summary-card--warning' : ''}`}>
                <span className="admin-summary-card__value">{deletedSuggestions.length}</span>
                <span className="admin-summary-card__label">Deleted candidates</span>
              </div>
              <div className="admin-summary-card">
                <span className="admin-summary-card__value">{totalVotes}</span>
                <span className="admin-summary-card__label">Total votes cast</span>
              </div>
              {campaign.updatedAt && (
                <div className="admin-summary-card">
                  <span className="admin-summary-card__value">{new Date(campaign.updatedAt).toLocaleDateString()}</span>
                  <span className="admin-summary-card__label">Last modified</span>
                </div>
              )}
            </div>
          </section>

          {/* ── Campaign actions ───────────────────────────────────────────── */}
          <section className="admin-section admin-section--danger">
            <h2>Campaign actions</h2>
            <p className="admin-section__description">
              These actions affect all data for this campaign. Each requires confirmation before executing.
            </p>
            <div className="admin-action-row">
              <div className="admin-action">
                <strong>Reset votes</strong>
                <p><span className="admin-action__affects">Affects:</span> All vote records — every candidate's vote count is reset to zero.</p>
                <p><span className="admin-action__preserves">Preserved:</span> All candidates (active and deleted) remain intact.</p>
                <button type="button" className="admin-btn admin-btn--danger" onClick={handleResetVotes}>
                  Reset votes
                </button>
              </div>
              <div className="admin-action">
                <strong>Reset candidates</strong>
                <p><span className="admin-action__affects">Affects:</span> All {suggestions.length} active candidate{suggestions.length !== 1 ? 's' : ''} are soft-deleted. All votes are removed.</p>
                <p><span className="admin-action__preserves">Preserved:</span> Candidates are soft-deleted and restorable individually. Campaign settings unchanged.</p>
                <button type="button" className="admin-btn admin-btn--danger" onClick={handleResetSuggestions}>
                  Reset candidates
                </button>
              </div>
              <div className="admin-action admin-action--destructive">
                <strong>⚠️ Full reset</strong>
                <p><span className="admin-action__affects">Affects:</span> ALL votes deleted AND ALL active candidates soft-deleted.</p>
                <p><span className="admin-action__preserves">Preserved:</span> Campaign settings only. Requires typing the campaign ID to confirm.</p>
                <button type="button" className="admin-btn admin-btn--destructive" onClick={handleFullReset}>
                  Full reset
                </button>
              </div>
            </div>
          </section>

          {/* ── Delete metadata ────────────────────────────────────────────── */}
          <section className="admin-section">
            <h2>Delete metadata</h2>
            <p className="admin-section__description">
              Optional metadata attached to individual candidate deletions for audit purposes.
            </p>
            <div className="admin-form admin-form--inline">
              <label htmlFor="deleted-by">Deleted by</label>
              <input
                id="deleted-by"
                type="text"
                value={deletedBy}
                onChange={(e) => setDeletedBy(e.target.value)}
                placeholder="Your name or identifier"
              />
              <label htmlFor="delete-reason">Reason</label>
              <input
                id="delete-reason"
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Optional reason for deletion"
              />
            </div>
          </section>

          {/* ── Active candidates ──────────────────────────────────────────── */}
          <section className="admin-section">
            <h2>Active candidates ({suggestions.length})</h2>
            {suggestions.length === 0 ? (
              <p className="admin-empty">No active candidates.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Candidate</th>
                    <th>Votes</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions
                    .slice()
                    .sort((a, b) => a.questionId.localeCompare(b.questionId) || a.name.localeCompare(b.name))
                    .map((s) => (
                      <tr key={s.id}>
                        <td>{questionById[s.questionId]?.title ?? s.questionId}</td>
                        <td>{s.name}</td>
                        <td>{s.votes}</td>
                        <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm admin-btn--danger"
                            onClick={() => handleDeleteSuggestion(s)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </section>

          {/* ── Deleted candidates ─────────────────────────────────────────── */}
          <section className="admin-section">
            <h2>Deleted candidates ({deletedSuggestions.length})</h2>
            <p className="admin-section__description">
              Soft-deleted candidates are hidden from voters but preserved for audit.
              Restoring a candidate makes it immediately visible to voters with its original vote count intact.
              While a candidate is deleted, its preserved votes do not count against voters&apos; remaining budgets.
              Restoring it makes those preserved votes active again immediately.
            </p>
            {deletedSuggestions.length === 0 ? (
              <p className="admin-empty">No deleted candidates.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Candidate</th>
                    <th>Votes</th>
                    <th>Deleted at</th>
                    <th>Deleted by</th>
                    <th>Reason</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deletedSuggestions
                    .slice()
                    .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''))
                    .map((s) => (
                      <tr key={s.id} className="admin-table__row--deleted">
                        <td>{questionById[s.questionId]?.title ?? s.questionId}</td>
                        <td>{s.name}</td>
                        <td>{s.votes}</td>
                        <td>{s.deletedAt ? new Date(s.deletedAt).toLocaleString() : '—'}</td>
                        <td>{s.deletedBy || '—'}</td>
                        <td>{s.deleteReason || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm admin-btn--restore"
                            onClick={() => handleRestoreSuggestion(s)}
                          >
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {/* ── Confirmation dialog ───────────────────────────────────────────── */}
      {confirm && (
        <div className="admin-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="admin-dialog">
            <h3 id="confirm-title">{confirm.title}</h3>
            <p style={{ whiteSpace: 'pre-line' }}>{confirm.message}</p>
            {confirm.confirmText && (
              <div className="admin-dialog__confirm-field">
                <label htmlFor="confirm-input" className="admin-dialog__confirm-label">
                  Type <strong>{confirm.confirmText}</strong> to confirm:
                </label>
                <input
                  id="confirm-input"
                  type="text"
                  value={confirmInputValue}
                  onChange={(e) => setConfirmInputValue(e.target.value)}
                  placeholder={confirm.confirmText}
                  autoComplete="off"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  className="admin-dialog__confirm-input"
                />
              </div>
            )}
            <div className="admin-dialog__actions">
              <button
                type="button"
                className="admin-btn"
                onClick={() => { setConfirm(null); setConfirmInputValue('') }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`admin-btn ${confirm.isDangerous !== false ? 'admin-btn--destructive' : 'admin-btn--restore'}`}
                onClick={confirm.onConfirm}
                disabled={!canConfirm}
              >
                {confirm.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
