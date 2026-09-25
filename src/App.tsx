import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { Footer } from './components/Footer'
import { Leaderboard } from './components/Leaderboard'
import { QuestionCard } from './components/QuestionCard'
import { SuggestionBoard } from './components/SuggestionBoard'
import { SuggestionForm } from './components/SuggestionForm'
import { VotingRules } from './components/VotingRules'
import type { Campaign, Question, Suggestion } from './types'
import { ApiError, fetchCampaign, fetchQuestions, fetchSuggestions, fetchVoteCounts, postSuggestion, postVote } from './api'
import { getSessionId } from './utils/sessionId'
import { canCastVote, getClientVoteRecords } from './utils/voteLimits'
import { handleImageError } from './utils/imageError'
import { useDocumentTitle } from './hooks/useDocumentTitle'

interface AppProps {
  campaignId: string
}

const STALE_DATA_MESSAGE =
  "This candidate no longer exists. Your data may be out of date. Please click 'Refresh Data' to retrieve the latest information."

function formatLastUpdated(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function App({ campaignId }: AppProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [campaignNotFound, setCampaignNotFound] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedQuestionId, setSelectedQuestionId] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [voteCountById, setVoteCountById] = useState<Map<string, number>>(new Map())
  const [actionError, setActionError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshSuccessMessage, setRefreshSuccessMessage] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  const voteRecords = getClientVoteRecords(suggestions, voteCountById)

  useDocumentTitle(
    campaign
      ? `${campaign.title} | MoodMile`
      : campaignNotFound
        ? 'Campaign not found | MoodMile'
        : 'MoodMile',
  )

  const refreshData = useCallback(async ({ manual = false }: { manual?: boolean } = {}) => {
    const sessionId = getSessionId()
    if (manual) {
      setIsRefreshing(true)
      setRefreshSuccessMessage('')
    }
    setCampaignNotFound(false)

    try {
      const loadedCampaign = await fetchCampaign(campaignId)
      const [loadedQuestions, loadedSuggestions, loadedVoteCounts] = await Promise.all([
        fetchQuestions(campaignId),
        fetchSuggestions(campaignId),
        fetchVoteCounts(campaignId, sessionId),
      ])

      setCampaign(loadedCampaign)
      setQuestions(loadedQuestions)
      setSelectedQuestionId((current) =>
        current && loadedQuestions.some((question) => question.id === current)
          ? current
          : (loadedQuestions[0]?.id ?? ''),
      )
      setSuggestions(loadedSuggestions)
      setVoteCountById(loadedVoteCounts)
      setLastUpdatedAt(new Date().toISOString())

      if (manual) {
        setActionError(null)
        setRefreshSuccessMessage('Data updated successfully')
        setTimeout(() => setRefreshSuccessMessage(''), 4000)
      }
    } catch (err: unknown) {
      const isNotFound = err instanceof ApiError && err.status === 404
      if (isNotFound) {
        setCampaignNotFound(true)
      }
      if (manual) {
        setActionError('Could not refresh data. Please try again.')
      }
      // Other errors: app stays in loading state with empty data
    } finally {
      if (manual) {
        setIsRefreshing(false)
      }
    }
  }, [campaignId])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  const handleSuggestionSubmit = (name: string) => {
    if (!selectedQuestionId || !campaign) {
      return
    }

    // Client-side duplicate guard (UX): normalise and skip if already present
    const isDuplicate = suggestions.some(
      (s) =>
        s.questionId === selectedQuestionId &&
        s.name.trim().toLowerCase() === name.trim().toLowerCase(),
    )
    if (isDuplicate) {
      return
    }

    // Optimistic: add immediately so the UI responds without waiting for the API round trip.
    const tempId = crypto.randomUUID()
    const optimistic: Suggestion = {
      id: tempId,
      campaignId: campaign.id,
      questionId: selectedQuestionId,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      votes: 0,
    }
    setSuggestions((current) => [...current, optimistic])

    // Persist to backend and swap the temp entry for the server-assigned one
    postSuggestion(campaign.id, selectedQuestionId, name.trim())
      .then((created) => {
        if (created) {
          setSuggestions((current) =>
            current.map((s) => (s.id === tempId ? created : s)),
          )
        } else {
          // Backend rejected (e.g. race-condition duplicate) — remove optimistic entry
          setSuggestions((current) => current.filter((s) => s.id !== tempId))
        }
      })
      .catch((err: unknown) => {
        setSuggestions((current) => current.filter((s) => s.id !== tempId))
        if (err instanceof ApiError && err.status === 403) {
          setActionError('Suggestions are closed for this campaign.')
          void refreshData()
          return
        }
        setActionError(err instanceof Error ? err.message : 'Failed to save suggestion. Please try again.')
      })
  }

  const handleVote = async (suggestionId: string, revoke: boolean) => {
    if (!campaign) return
    const currentCampaign = campaign
    const sessionId = getSessionId()
    const suggestion = suggestions.find((s) => s.id === suggestionId)
    if (!suggestion) return

    if (!revoke && !canCastVote(currentCampaign, voteRecords, suggestion.questionId, suggestion.id)) {
      return
    }

    let updated: Suggestion | null
    try {
      updated = await postVote(
        currentCampaign.id,
        suggestion.questionId,
        suggestionId,
        sessionId,
        revoke,
      )
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setActionError(STALE_DATA_MESSAGE)
        return
      }
      setActionError('Vote could not be saved. Please try again.')
      return
    }

    if (!updated) {
      setActionError('Vote could not be saved. Please try again.')
      return
    }

    setSuggestions((current) =>
      current.map((s) => {
        if (s.id !== suggestionId) return s
        return updated
      }),
    )

    setVoteCountById((current) => {
      const next = new Map(current)
      if (revoke) {
        const newCount = Math.max(0, (next.get(suggestionId) ?? 0) - 1)
        if (newCount === 0) {
          next.delete(suggestionId)
        } else {
          next.set(suggestionId, newCount)
        }
      } else {
        next.set(suggestionId, (next.get(suggestionId) ?? 0) + 1)
      }
      return next
    })
  }

  const isVoteDisabled = (suggestionId: string) => {
    if (!campaign) return false
    const suggestion = suggestions.find((item) => item.id === suggestionId)
    if (!suggestion) {
      return false
    }
    if (campaign.maxVotesPerCandidate === 1 && (voteCountById.get(suggestionId) ?? 0) > 0) {
      return false
    }

    return !canCastVote(campaign, voteRecords, suggestion.questionId, suggestion.id)
  }

  if (campaignNotFound) {
    return (
      <main className="app-shell">
        <section className="hero">
          <p className="hero__eyebrow">MOODMILE</p>
          <h1>Campaign not found</h1>
        </section>
        <div className="empty-state">
          {/* Search / not-found icon */}
          <svg className="empty-state__icon" viewBox="0 0 48 48" fill="none" aria-hidden="true" width="56" height="56">
            <circle cx="21" cy="21" r="13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M30 30l9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M17 21h8M21 17v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity=".5" />
          </svg>
          <p className="empty-state__desc">
            The campaign you are looking for does not exist or is no longer available.
          </p>
        </div>
        <Footer />
      </main>
    )
  }

  if (!campaign) {
    return (
      <main className="app-shell">
        <div className="loading-state">
          <div className="loading-spinner" role="progressbar" aria-label="Loading campaign…" />
          <span className="loading-state__label">Loading campaign…</span>
        </div>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">MOODMILE</p>
          <h1>{campaign.title}</h1>
          <p>{campaign.description}</p>
        </div>
        {campaign.bannerImageUrl && (
          <div className="hero__media">
            <img
              src={campaign.bannerImageUrl}
              alt=""
              aria-hidden="true"
              className="hero__banner"
              onError={handleImageError}
            />
          </div>
        )}
      </section>

      <section className="data-refresh" aria-label="Data refresh" aria-busy={isRefreshing}>
        <div className="data-refresh__meta">
          {lastUpdatedAt && (
            <span className="data-refresh__timestamp">
              Last updated: {formatLastUpdated(lastUpdatedAt)}
            </span>
          )}
          {refreshSuccessMessage && (
            <span className="data-refresh__success" role="status">
              {/* Checkmark icon */}
              <svg viewBox="0 0 14 14" fill="none" aria-hidden="true" width="12" height="12">
                <path d="M2.5 7l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {refreshSuccessMessage}
            </span>
          )}
        </div>
        <button
          type="button"
          className="data-refresh__button"
          onClick={() => void refreshData({ manual: true })}
          disabled={isRefreshing}
        >
          {/* Refresh icon */}
          <svg viewBox="0 0 14 14" fill="none" aria-hidden="true" width="12" height="12">
            <path d="M12.5 2v3.5H9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12.3 5.5A5.5 5.5 0 1 1 9.3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          {isRefreshing ? 'Refreshing…' : 'Refresh data'}
        </button>
      </section>

      {actionError && (
        <p className="action-error" role="alert">
          <span className="action-error__body">{actionError}</span>
          <button
            type="button"
            className="action-error__dismiss"
            aria-label="Dismiss"
            onClick={() => setActionError(null)}
          >
            ×
          </button>
        </p>
      )}

      <section className="mascots" aria-label="Questions">
        {questions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            isSelected={selectedQuestionId === question.id}
            onSelect={setSelectedQuestionId}
          />
        ))}
      </section>

      <VotingRules
        maxVotesTotal={campaign.maxVotesTotal}
        maxVotesPerCategory={campaign.maxVotesPerCategory}
        maxVotesPerCandidate={campaign.maxVotesPerCandidate}
        questionCount={questions.length}
        votesUsed={voteRecords.length}
      />

      {campaign.allowSuggestions ? (
        <SuggestionForm
          questions={questions}
          selectedQuestionId={selectedQuestionId}
          onQuestionChange={setSelectedQuestionId}
          onSubmitSuggestion={handleSuggestionSubmit}
        />
      ) : (
        <section className="suggestion-state suggestion-state--closed" aria-label="Suggestions closed">
          <h2>Suggestions are closed</h2>
          <p>This campaign is in voting-only mode. You can still review the published candidates and cast votes.</p>
        </section>
      )}

      <SuggestionBoard
        campaign={campaign}
        questions={questions}
        suggestions={suggestions}
        voteCountById={voteCountById}
        onVote={handleVote}
        isVoteDisabled={isVoteDisabled}
      />

      <Leaderboard
        campaign={campaign}
        questions={questions}
        suggestions={suggestions}
        voteCountById={voteCountById}
        onVote={handleVote}
        isVoteDisabled={isVoteDisabled}
      />

      <Footer />
    </main>
  )
}

export default App
