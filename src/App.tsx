import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { Footer } from './components/Footer'
import { Leaderboard } from './components/Leaderboard'
import { QuestionCard } from './components/QuestionCard'
import { SuggestionBoard } from './components/SuggestionBoard'
import { SuggestionForm } from './components/SuggestionForm'
import { VotingRules } from './components/VotingRules'
import type { Campaign, Question, QuestionResponse, Suggestion } from './types'
import { ApiError, fetchCampaign, fetchQuestions, fetchSuggestions, fetchVoteCounts, fetchQuestionResponses, postQuestionResponse, postSuggestion, postVote } from './api'
import { getSessionId } from './utils/sessionId'
import { canCastVote, getClientVoteRecords } from './utils/voteLimits'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import { QuestionResponseForm } from './components/QuestionResponseForm'

interface AppProps {
  campaignId: string
}

const STALE_DATA_MESSAGE =
  "This candidate no longer exists. Your data may be out of date. Please click 'Refresh Data' to retrieve the latest information."
const DUPLICATE_SUGGESTION_MESSAGE = 'That answer has already been submitted for this question.'

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
  const [questionResponses, setQuestionResponses] = useState<QuestionResponse[]>([])
  const [voteCountById, setVoteCountById] = useState<Map<string, number>>(new Map())
  const [actionError, setActionError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshSuccessMessage, setRefreshSuccessMessage] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [failedBannerUrl, setFailedBannerUrl] = useState<string | null>(null)

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
      const [loadedQuestions, loadedSuggestions, loadedVoteCounts, loadedResponses] = await Promise.all([
        fetchQuestions(campaignId),
        fetchSuggestions(campaignId),
        fetchVoteCounts(campaignId, sessionId),
        fetchQuestionResponses(campaignId),
      ])

      setCampaign(loadedCampaign)
      setQuestions(loadedQuestions)
      setSelectedQuestionId((current) =>
        current && loadedQuestions.some((question) => question.id === current)
          ? current
          : (loadedQuestions[0]?.id ?? ''),
      )
      setSuggestions(loadedSuggestions)
      setQuestionResponses(loadedResponses)
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

    setActionError(null)

    // Client-side duplicate guard (UX): normalise and skip if already present
    const isDuplicate = suggestions.some(
      (s) =>
        s.questionId === selectedQuestionId &&
        s.name.trim().toLowerCase() === name.trim().toLowerCase(),
    )
    if (isDuplicate) {
      setActionError(DUPLICATE_SUGGESTION_MESSAGE)
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
    postSuggestion(campaign.id, selectedQuestionId, name.trim(), getSessionId())
      .then((created) => {
        if (created) {
          setSuggestions((current) =>
            current.map((s) => (s.id === tempId ? created : s)),
          )
        } else {
          // Backend rejected (e.g. race-condition duplicate) — remove optimistic entry
          setSuggestions((current) => current.filter((s) => s.id !== tempId))
          setActionError(DUPLICATE_SUGGESTION_MESSAGE)
        }
      })
      .catch((err: unknown) => {
        setSuggestions((current) => current.filter((s) => s.id !== tempId))
        if (err instanceof ApiError && err.status === 403) {
          setActionError('Suggestions are closed for this question.')
          void refreshData()
          return
        }
        setActionError(err instanceof Error ? err.message : 'Failed to save suggestion. Please try again.')
      })
  }

  const handleQuestionResponseSubmit = async (question: Question, answer: QuestionResponse['answer']): Promise<boolean> => {
    if (!campaign) return false
    try {
      await postQuestionResponse(campaign.id, question.id, answer, getSessionId())
      setQuestionResponses(await fetchQuestionResponses(campaign.id))
      setActionError(null)
      return true
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save your answer.')
      return false
    }
  }

  const handleVote = async (suggestionId: string, revoke: boolean) => {
    if (!campaign) return
    const currentCampaign = campaign
    const sessionId = getSessionId()
    const suggestion = suggestions.find((s) => s.id === suggestionId)
    if (!suggestion) return
    const question = questions.find((item) => item.id === suggestion.questionId)
    if (!question || question.questionType !== 'text' || (question.numberOfVotes ?? 0) <= 0) return

    if (!revoke && !canCastVote(currentCampaign, voteRecords, suggestion.questionId, suggestion.id, question)) {
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
    const question = questions.find((item) => item.id === suggestion.questionId)
    if (!question || question.questionType !== 'text' || (question.numberOfVotes ?? 0) <= 0) {
      return true
    }
    if (!question.duplicateVotingAllowed && (voteCountById.get(suggestionId) ?? 0) > 0) {
      return false
    }

    return !canCastVote(campaign, voteRecords, suggestion.questionId, suggestion.id, question)
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

  const bannerImageUrl = campaign.bannerImageUrl?.trim()
  const showBanner = Boolean(bannerImageUrl && failedBannerUrl !== bannerImageUrl)
  const selectedQuestion = questions.find((question) => question.id === selectedQuestionId)
  const suggestionQuestions = questions.filter((question) => question.questionType === 'text')
  const votableQuestions = suggestionQuestions.filter((question) => (question.numberOfVotes ?? 0) > 0)
  const visibleSuggestions = suggestions.filter((suggestion) => votableQuestions.some((question) => question.id === suggestion.questionId))
  const answerResults = selectedQuestion
    ? questionResponses.filter((response) => response.questionId === selectedQuestion.id)
    : []

  return (
    <main className="app-shell">
      {showBanner ? (
        <section className="hero hero--image">
          <div className="hero__accessible-text">
            <h1>{campaign.title}</h1>
            <p>{campaign.description}</p>
          </div>
          <img
            src={bannerImageUrl}
            alt=""
            aria-hidden="true"
            className="hero__banner"
            onError={() => setFailedBannerUrl(bannerImageUrl!)}
          />
        </section>
      ) : (
        <section className="hero">
          <div className="hero__content">
            <p className="hero__eyebrow">MOODMILE</p>
            <h1>{campaign.title}</h1>
            <p>{campaign.description}</p>
          </div>
        </section>
      )}

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
            hideTitle={questions.length === 1}
          />
        ))}
      </section>

      {questions.some((question) => question.questionType === 'text' && (question.numberOfVotes ?? 0) > 0) && <VotingRules
        maxVotesTotal={campaign.maxVotesTotal}
        maxVotesPerCategory={campaign.maxVotesPerCategory}
        maxVotesPerCandidate={campaign.maxVotesPerCandidate}
        votesUsed={voteRecords.length}
      />}

      {selectedQuestion?.questionType === 'text' && selectedQuestion.allowSuggestions ? (
        <SuggestionForm
          questions={suggestionQuestions}
          selectedQuestionId={selectedQuestion.id}
          onQuestionChange={setSelectedQuestionId}
          onSubmitSuggestion={handleSuggestionSubmit}
        />
      ) : selectedQuestion && selectedQuestion.questionType !== 'text' ? (
        <QuestionResponseForm
          key={selectedQuestion.id}
          question={selectedQuestion}
          onSubmit={(answer) => handleQuestionResponseSubmit(selectedQuestion, answer)}
        />
      ) : null}
      {selectedQuestion?.questionType === 'text' && !selectedQuestion.allowSuggestions && (
        <section className="suggestion-state suggestion-state--closed" aria-label="Suggestions closed">
          <h2>{(selectedQuestion.numberOfVotes ?? 0) > 0 ? 'Suggestions are closed' : 'Text responses are closed'}</h2>
          <p>
            {(selectedQuestion.numberOfVotes ?? 0) > 0
              ? 'This question is in voting-only mode. You can still review published candidates and cast votes.'
              : 'Submissions and voting are closed for this question.'}
          </p>
        </section>
      )}

      {selectedQuestion && selectedQuestion.questionType !== 'text' && answerResults.length > 0 && (
        <section className="suggestion-board" aria-label="Answer results">
          <h2>Responses</h2>
          <ul>
            {answerResults.map((result) => (
              <li key={JSON.stringify(result.answer)}>
                <span>{Array.isArray(result.answer) ? result.answer.join(', ') : String(result.answer)}</span>
                <span>{result.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {suggestionQuestions.length > 0 && (
        <SuggestionBoard
          questions={suggestionQuestions}
          suggestions={suggestions.filter((suggestion) => suggestionQuestions.some((question) => question.id === suggestion.questionId))}
          voteCountById={voteCountById}
          onVote={handleVote}
          isVoteDisabled={isVoteDisabled}
        />
      )}

      {votableQuestions.length > 0 && (
        <Leaderboard
          questions={votableQuestions}
          suggestions={visibleSuggestions}
          voteCountById={voteCountById}
          onVote={handleVote}
          isVoteDisabled={isVoteDisabled}
        />
      )}

      <Footer />
    </main>
  )
}

export default App
