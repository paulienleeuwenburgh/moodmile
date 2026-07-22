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
  onConfirm: () => void
}

export function AdminPage() {
  const [secret, setSecret] = useState('')
  const [campaignId, setCampaignId] = useState('ninja-naming')
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [deletedSuggestions, setDeletedSuggestions] = useState<DeletedSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deletedBy, setDeletedBy] = useState('')

  const questionById = Object.fromEntries(questions.map((q) => [q.id, q]))

  function showSuccess(msg: string) {
    setSuccessMessage(msg)
    setError('')
    setTimeout(() => setSuccessMessage(''), 4000)
  }

  function showError(msg: string) {
    setError(msg)
    setSuccessMessage('')
  }

  async function loadCampaign() {
    if (!secret.trim()) {
      showError('Please enter the admin secret.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const [c, q, s, d] = await Promise.all([
        fetchCampaign(campaignId),
        fetchQuestions(campaignId),
        fetchSuggestions(campaignId),
        fetchDeletedSuggestions(secret, campaignId),
      ])
      setCampaign(c)
      setQuestions(q)
      setSuggestions(s)
      setDeletedSuggestions(d)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load campaign.')
      setCampaign(null)
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
    } catch {
      // ignore refresh errors silently
    }
  }

  function ask(dialog: ConfirmDialog) {
    setConfirm(dialog)
  }

  async function handleDeleteSuggestion(suggestion: Suggestion) {
    ask({
      title: 'Delete candidate',
      message: `Soft-delete "${suggestion.name}"? The candidate will be hidden from voting and rankings. Votes are preserved. You can restore this candidate later.`,
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
          showSuccess(`"${suggestion.name}" has been deleted.`)
          setDeleteReason('')
          await refresh()
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Delete failed.')
        }
      },
    })
  }

  async function handleRestoreSuggestion(suggestion: DeletedSuggestion) {
    ask({
      title: 'Restore candidate',
      message: `Restore "${suggestion.name}"? The candidate will reappear in voting with its original vote count. Voting resumes immediately.`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await adminRestoreSuggestion(secret, suggestion.campaignId, suggestion.questionId, suggestion.id)
          showSuccess(`"${suggestion.name}" has been restored.`)
          await refresh()
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Restore failed.')
        }
      },
    })
  }

  async function handleResetVotes() {
    ask({
      title: 'Reset all votes',
      message: `Remove ALL votes for "${campaign?.title}"? All vote counts will be set to zero. Candidates are kept. This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await adminResetVotes(secret, campaignId)
          showSuccess('All votes have been reset.')
          await refresh()
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Vote reset failed.')
        }
      },
    })
  }

  async function handleResetSuggestions() {
    ask({
      title: 'Reset all candidates',
      message: `Soft-delete ALL candidates for "${campaign?.title}" and remove all votes? Candidates are soft-deleted (restorable). This cannot be undone for votes.`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await adminResetSuggestions(secret, campaignId)
          showSuccess('All candidates have been reset.')
          await refresh()
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Suggestion reset failed.')
        }
      },
    })
  }

  async function handleFullReset() {
    ask({
      title: '⚠ Full campaign reset',
      message: `Completely reset "${campaign?.title}"? ALL votes will be deleted and ALL candidates will be soft-deleted. Campaign settings are preserved. This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await adminFullReset(secret, campaignId)
          showSuccess('Campaign has been fully reset.')
          await refresh()
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Full reset failed.')
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

      {/* ── Auth + Campaign loader ─────────────────────────────────────────── */}
      <section className="admin-section">
        <h2>Access</h2>
        <div className="admin-form">
          <label htmlFor="admin-secret">Admin secret</label>
          <input
            id="admin-secret"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter admin secret"
            autoComplete="current-password"
          />
          <label htmlFor="campaign-id">Campaign ID</label>
          <input
            id="campaign-id"
            type="text"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            placeholder="e.g. ninja-naming"
          />
          <button type="button" onClick={loadCampaign} disabled={loading} className="admin-btn">
            {loading ? 'Loading…' : 'Load campaign'}
          </button>
        </div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {successMessage && <p className="admin-success" role="status">{successMessage}</p>}
      </section>

      {/* ── Campaign details ──────────────────────────────────────────────── */}
      {campaign && (
        <>
          <section className="admin-section">
            <h2>Campaign: {campaign.title}</h2>
            <dl className="admin-dl">
              <dt>Status</dt><dd>{campaign.status}</dd>
              <dt>Max votes total</dt><dd>{campaign.maxVotesTotal || 'Unlimited'}</dd>
              <dt>Max votes per category</dt><dd>{campaign.maxVotesPerCategory || 'Unlimited'}</dd>
              <dt>Max votes per candidate</dt><dd>{campaign.maxVotesPerCandidate || 'Unlimited'}</dd>
              <dt>Suggestions allowed</dt><dd>{campaign.allowSuggestions ? 'Yes' : 'No'}</dd>
            </dl>
          </section>

          {/* ── Destructive campaign actions ──────────────────────────────── */}
          <section className="admin-section admin-section--danger">
            <h2>Campaign actions</h2>
            <p className="admin-section__description">
              These actions affect all data for this campaign. Each requires confirmation.
            </p>
            <div className="admin-action-row">
              <div className="admin-action">
                <strong>Reset votes</strong>
                <p>Remove all votes. Candidates are kept.</p>
                <button type="button" className="admin-btn admin-btn--danger" onClick={handleResetVotes}>
                  Reset votes
                </button>
              </div>
              <div className="admin-action">
                <strong>Reset candidates</strong>
                <p>Soft-delete all candidates and remove all votes. Candidates can be restored individually.</p>
                <button type="button" className="admin-btn admin-btn--danger" onClick={handleResetSuggestions}>
                  Reset candidates
                </button>
              </div>
              <div className="admin-action">
                <strong>Full reset</strong>
                <p>Remove all votes and soft-delete all candidates. Campaign settings are preserved.</p>
                <button type="button" className="admin-btn admin-btn--destructive" onClick={handleFullReset}>
                  Full reset
                </button>
              </div>
            </div>
          </section>

          {/* ── Delete metadata ───────────────────────────────────────────── */}
          <section className="admin-section">
            <h2>Delete metadata</h2>
            <p className="admin-section__description">
              Optional metadata attached to individual candidate deletions.
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

          {/* ── Active candidates ─────────────────────────────────────────── */}
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

          {/* ── Deleted candidates ────────────────────────────────────────── */}
          <section className="admin-section">
            <h2>Deleted candidates ({deletedSuggestions.length})</h2>
            <p className="admin-section__description">
              Soft-deleted candidates are hidden from voters but preserved for audit.
              Restoring a candidate makes it visible again with its original vote count intact.
              Votes previously cast for this candidate count against voters&#39; budgets even while deleted.
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
                        <td>{s.deletedAt ? new Date(s.deletedAt).toLocaleDateString() : '—'}</td>
                        <td>{s.deletedBy || '—'}</td>
                        <td>{s.deleteReason || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm"
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

      {/* ── Confirmation dialog ────────────────────────────────────────────── */}
      {confirm && (
        <div className="admin-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="admin-dialog">
            <h3 id="confirm-title">{confirm.title}</h3>
            <p>{confirm.message}</p>
            <div className="admin-dialog__actions">
              <button type="button" className="admin-btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="admin-btn admin-btn--destructive" onClick={confirm.onConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
