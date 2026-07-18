import type { Mascot, Suggestion } from '../types'

interface LeaderboardProps {
  mascots: Mascot[]
  suggestions: Suggestion[]
  votedIds: Set<string>
  onVote: (suggestionId: string) => void
}

export function Leaderboard({ mascots, suggestions, votedIds, onVote }: LeaderboardProps) {
  const ranked = [...suggestions].sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt))

  if (ranked.length === 0) {
    return null
  }

  const mascotById = Object.fromEntries(mascots.map((m) => [m.id, m]))

  return (
    <section className="leaderboard" aria-label="Leaderboard">
      <h2>Leaderboard</h2>
      <ol className="leaderboard__list">
        {ranked.map((suggestion, index) => {
          const mascot = mascotById[suggestion.mascotId]
          const hasVoted = votedIds.has(suggestion.id)
          return (
            <li key={suggestion.id} className="leaderboard-entry">
              <span className="leaderboard-entry__rank" aria-label={`Rank ${index + 1}`}>
                {index + 1}
              </span>
              {mascot && (
                <img
                  src={mascot.image}
                  alt=""
                  aria-hidden="true"
                  className="leaderboard-entry__mascot"
                />
              )}
              <span className="leaderboard-entry__name">{suggestion.name}</span>
              {mascot && (
                <span className="leaderboard-entry__mascot-title">{mascot.title}</span>
              )}
              <button
                type="button"
                className={`vote-btn${hasVoted ? ' vote-btn--voted' : ''}`}
                onClick={() => onVote(suggestion.id)}
                aria-pressed={hasVoted}
                aria-label={hasVoted ? `Remove vote for ${suggestion.name}` : `Vote for ${suggestion.name}`}
              >
                <span className="vote-btn__icon" aria-hidden="true">▲</span>
                <span className="vote-btn__count">{suggestion.votes}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
