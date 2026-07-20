import { useEffect, useState } from 'react'
import './App.css'
import { Leaderboard } from './components/Leaderboard'
import { QuestionCard } from './components/QuestionCard'
import { SuggestionBoard } from './components/SuggestionBoard'
import { SuggestionForm } from './components/SuggestionForm'
import { VotingRules } from './components/VotingRules'
import { defaultCampaign, questions as defaultQuestions } from './data/campaign'
import type { Campaign, Question, Suggestion } from './types'
import { fetchCampaign, fetchQuestions, fetchSuggestions, fetchVotedIds, postSuggestion, postVote } from './api'
import { getSessionId } from './utils/sessionId'
import { canCastVote, getClientVoteRecords } from './utils/voteLimits'

function App() {
  const [campaign, setCampaign] = useState<Campaign>(defaultCampaign)
  const [questions, setQuestions] = useState<Question[]>(defaultQuestions)
  const [selectedQuestionId, setSelectedQuestionId] = useState(defaultQuestions[0]?.id ?? '')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const voteRecords = getClientVoteRecords(suggestions, votedIds)

  useEffect(() => {
    const sessionId = getSessionId()
    fetchCampaign()
      .then((loadedCampaign) => {
        const id = loadedCampaign.id
        return Promise.all([
          Promise.resolve(loadedCampaign),
          fetchQuestions(id),
          fetchSuggestions(id),
          fetchVotedIds(id, sessionId),
        ])
      })
      .then(([loadedCampaign, loadedQuestions, loadedSuggestions, loadedVotedIds]) => {
        setCampaign(loadedCampaign)
        setQuestions(loadedQuestions)
        if (loadedQuestions.length > 0) {
          setSelectedQuestionId(loadedQuestions[0].id)
        }
        setSuggestions(loadedSuggestions)
        setVotedIds(loadedVotedIds)
      })
      .catch(() => {
        // Data load failed — the app remains functional with empty state
      })
  }, [])

  const handleSuggestionSubmit = (name: string) => {
    if (!selectedQuestionId) {
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
    const hasVoted = votedIds.has(suggestionId)
    const sessionId = getSessionId()
    const suggestion = suggestions.find((s) => s.id === suggestionId)
    if (!suggestion) return

    if (!hasVoted && !canCastVote(campaign, voteRecords, suggestion.questionId, suggestion.id)) {
      return
    }

    const updated = await postVote(
      campaign.id,
      suggestion.questionId,
      suggestionId,
      sessionId,
      hasVoted,
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

    setVotedIds((current) => {
      const next = new Set(current)
      if (hasVoted) {
        next.delete(suggestionId)
      } else {
        next.add(suggestionId)
      }
      return next
    })
  }

  const isVoteDisabled = (suggestionId: string) => {
    const suggestion = suggestions.find((item) => item.id === suggestionId)
    if (!suggestion) {
      return false
    }

    return !votedIds.has(suggestionId)
      && !canCastVote(campaign, voteRecords, suggestion.questionId, suggestion.id)
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
