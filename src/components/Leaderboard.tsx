import type { Question, Suggestion } from '../types'

interface LeaderboardProps {
  questions: Question[]
  suggestions: Suggestion[]
  votedIds: Set<string>
  onVote: (suggestionId: string) => void | Promise<void>
  isVoteDisabled?: (suggestionId: string) => boolean
}

export function Leaderboard({
  questions,
  suggestions,
  votedIds,
  onVote,
  isVoteDisabled,
}: LeaderboardProps) {
  const ranked = [...suggestions].sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt))

  if (ranked.length === 0) {
    return null
  }

  const questionById = Object.fromEntries(questions.map((q) => [q.id, q]))

  return (
    <section className="leaderboard" aria-label="Leaderboard">
      <h2>Leaderboard</h2>
      <ol className="leaderboard__list">
        {ranked.map((suggestion, index) => {
          const question = questionById[suggestion.questionId]
          const hasVoted = votedIds.has(suggestion.id)
          const isDisabled = !hasVoted && Boolean(isVoteDisabled?.(suggestion.id))
          return (
            <li key={suggestion.id} className="leaderboard-entry">
              <span className="leaderboard-entry__rank" aria-label={`Rank ${index + 1}`}>
                {index + 1}
              </span>
              {question?.imageUrl && (
                <img
                  src={question.imageUrl}
                  alt=""
                  aria-hidden="true"
                  className="leaderboard-entry__mascot"
                />
              )}
              <span className="leaderboard-entry__name">{suggestion.name}</span>
              {question && (
                <span className="leaderboard-entry__mascot-title">{question.title}</span>
              )}
              <button
                type="button"
                className={`vote-btn${hasVoted ? ' vote-btn--voted' : ''}`}
                onClick={() => onVote(suggestion.id)}
                disabled={isDisabled}
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
