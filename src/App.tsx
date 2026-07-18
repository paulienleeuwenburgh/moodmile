import { useEffect, useState } from 'react'
import './App.css'
import { Leaderboard } from './components/Leaderboard'
import { MascotCard } from './components/MascotCard'
import { SuggestionBoard } from './components/SuggestionBoard'
import { SuggestionForm } from './components/SuggestionForm'
import { mascots } from './data/mascots'
import type { Suggestion } from './types'
import { fetchSuggestions, fetchVotedIds, postSuggestion, postVote } from './api'
import { getSessionId } from './utils/sessionId'

function App() {
  const [selectedMascotId, setSelectedMascotId] = useState(mascots[0]?.id ?? '')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const sessionId = getSessionId()
    Promise.all([fetchSuggestions(), fetchVotedIds(sessionId)]).then(
      ([loadedSuggestions, loadedVotedIds]) => {
        setSuggestions(loadedSuggestions)
        setVotedIds(loadedVotedIds)
      },
    ).catch(() => {
      // Data load failed — the app remains functional with empty state
    })
  }, [])

  const handleSuggestionSubmit = (name: string) => {
    if (!selectedMascotId) {
      return
    }

    // Client-side duplicate guard (UX): normalise and skip if already present
    const isDuplicate = suggestions.some(
      (s) =>
        s.mascotId === selectedMascotId &&
        s.name.trim().toLowerCase() === name.trim().toLowerCase(),
    )
    if (isDuplicate) {
      return
    }

    // Optimistic: add immediately so the UI responds without waiting for the API round trip.
    const tempId = crypto.randomUUID()
    const optimistic: Suggestion = {
      id: tempId,
      mascotId: selectedMascotId,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      votes: 0,
    }
    setSuggestions((current) => [...current, optimistic])

    // Persist to backend and swap the temp entry for the server-assigned one
    postSuggestion(selectedMascotId, name.trim())
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

    const updated = await postVote(suggestionId, sessionId, hasVoted)

    setSuggestions((current) =>
      current.map((s) => {
        if (s.id !== suggestionId) return s
        return updated ?? { ...s, votes: hasVoted ? s.votes - 1 : s.votes + 1 }
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

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="hero__eyebrow">MoodMile 🥷 Ninja Naming Contest</p>
        <h1>Name Our Ninja Mascots</h1>
        <p>
          Four mysterious ninjas have joined the MoodMile squad — and they need names.
          Pick your favorite ninja, drop as many name ideas as you like, and vote for
          the ones that feel just right.
        </p>
      </section>

      <section className="mascots" aria-label="Mascot options">
        {mascots.map((mascot) => (
          <MascotCard
            key={mascot.id}
            mascot={mascot}
            isSelected={selectedMascotId === mascot.id}
            onSelect={setSelectedMascotId}
          />
        ))}
      </section>

      <SuggestionForm
        mascots={mascots}
        selectedMascotId={selectedMascotId}
        onMascotChange={setSelectedMascotId}
        onSubmitSuggestion={handleSuggestionSubmit}
      />

      <SuggestionBoard
        mascots={mascots}
        suggestions={suggestions}
        votedIds={votedIds}
        onVote={handleVote}
      />

      <Leaderboard
        mascots={mascots}
        suggestions={suggestions}
        votedIds={votedIds}
        onVote={handleVote}
      />
    </main>
  )
}

export default App
