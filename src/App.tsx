import { useMemo, useEffect, useState } from 'react'
import './App.css'
import { Leaderboard } from './components/Leaderboard'
import { QuestionCard } from './components/QuestionCard'
import { SuggestionBoard } from './components/SuggestionBoard'
import { SuggestionForm } from './components/SuggestionForm'
import { VotingRules } from './components/VotingRules'
import type { Campaign, Question, Suggestion } from './types'
import { fetchCampaign, fetchQuestions, fetchSuggestions, fetchVoteCounts, postSuggestion, postVote } from './api'
import { getSessionId } from './utils/sessionId'
import { canCastVote, getClientVoteRecords } from './utils/voteLimits'

interface AppProps {
  campaignId: string
}

function App({ campaignId }: AppProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [campaignNotFound, setCampaignNotFound] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedQuestionId, setSelectedQuestionId] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [voteCountById, setVoteCountById] = useState<Map<string, number>>(new Map())

  // Derive votedIds: a suggestion is "voted" (shows remove-vote button) when the user
  // has reached the per-candidate limit, or when maxVotesPerCandidate is unlimited and
  // they have cast at least one vote.
  const votedIds = useMemo(() => {
    const set = new Set<string>()
    for (const [id, count] of voteCountById) {
      const atLimit =
        (campaign?.maxVotesPerCandidate ?? 0) > 0
          ? count >= (campaign?.maxVotesPerCandidate ?? 1)
          : count > 0
      if (atLimit) set.add(id)
    }
    return set
  }, [voteCountById, campaign?.maxVotesPerCandidate])

  const voteRecords = getClientVoteRecords(suggestions, voteCountById)

  useEffect(() => {
    const sessionId = getSessionId()
    fetchCampaign(campaignId)
      .then((loadedCampaign) =>
        Promise.all([
          Promise.resolve(loadedCampaign),
          fetchQuestions(campaignId),
          fetchSuggestions(campaignId),
          fetchVoteCounts(campaignId, sessionId),
        ]),
      )
      .then(([loadedCampaign, loadedQuestions, loadedSuggestions, loadedVoteCounts]) => {
        setCampaign(loadedCampaign)
        setQuestions(loadedQuestions)
        if (loadedQuestions.length > 0) {
          setSelectedQuestionId(loadedQuestions[0].id)
        }
        setSuggestions(loadedSuggestions)
        setVoteCountById(loadedVoteCounts)
      })
      .catch((err: unknown) => {
        const isNotFound =
          err instanceof Error && err.message.includes('Campaign not found')
        if (isNotFound) {
          setCampaignNotFound(true)
        }
        // Other errors: app stays in loading state with empty data
      })
  }, [campaignId])

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
      .catch(() => {
        setSuggestions((current) => current.filter((s) => s.id !== tempId))
      })
  }

  const handleVote = async (suggestionId: string) => {
    if (!campaign) return
    // Capture the non-null campaign value so TypeScript (and async closures) stay safe
    // even if the state theoretically changes between the null check and the await below.
    const currentCampaign = campaign
    const revoke = votedIds.has(suggestionId)
    const sessionId = getSessionId()
    const suggestion = suggestions.find((s) => s.id === suggestionId)
    if (!suggestion) return

    if (!revoke && !canCastVote(currentCampaign, voteRecords, suggestion.questionId, suggestion.id)) {
      return
    }

    const updated = await postVote(
      currentCampaign.id,
      suggestion.questionId,
      suggestionId,
      sessionId,
      revoke,
    )

    if (!updated) {
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

    return !votedIds.has(suggestionId)
      && !canCastVote(campaign, voteRecords, suggestion.questionId, suggestion.id)
  }

  if (campaignNotFound) {
    return (
      <main className="app-shell">
        <section className="hero">
          <p className="hero__eyebrow">MOODMILE</p>
          <h1>Campaign not found</h1>
          <p>The campaign you are looking for does not exist or is no longer available.</p>
        </section>
      </main>
    )
  }

  if (!campaign) {
    return null
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="hero__eyebrow">MOODMILE</p>
        <h1>{campaign.title}</h1>
        <p>
          {campaign.description}
        </p>
      </section>

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
        votesUsed={voteRecords.length}
      />

      <SuggestionForm
        questions={questions}
        selectedQuestionId={selectedQuestionId}
        onQuestionChange={setSelectedQuestionId}
        onSubmitSuggestion={handleSuggestionSubmit}
      />

      <SuggestionBoard
        questions={questions}
        suggestions={suggestions}
        votedIds={votedIds}
        onVote={handleVote}
        isVoteDisabled={isVoteDisabled}
      />

      <Leaderboard
        questions={questions}
        suggestions={suggestions}
        votedIds={votedIds}
        onVote={handleVote}
        isVoteDisabled={isVoteDisabled}
      />
    </main>
  )
}

export default App
