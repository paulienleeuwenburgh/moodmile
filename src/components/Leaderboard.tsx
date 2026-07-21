import type { Question, Suggestion } from '../types'

interface LeaderboardProps {
  questions: Question[]
  suggestions: Suggestion[]
  onVote: (suggestionId: string) => void | Promise<void>
  onRemoveVote: (suggestionId: string) => void | Promise<void>
  canRemoveVote?: (suggestionId: string) => boolean
  isVoteDisabled?: (suggestionId: string) => boolean
}

export function Leaderboard({
  questions,
  suggestions,
  onVote,
  onRemoveVote,
  canRemoveVote,
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
          const canRemove = Boolean(canRemoveVote?.(suggestion.id))
          const isDisabled = Boolean(isVoteDisabled?.(suggestion.id))
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
              <div className="suggestion-card__actions">
                <button
                  type="button"
                  className="vote-btn"
                  onClick={() => onVote(suggestion.id)}
                  disabled={isDisabled}
                  aria-label={`Vote for ${suggestion.name}`}
                >
                  <span className="vote-btn__icon" aria-hidden="true">▲</span>
                  <span className="vote-btn__count">{suggestion.votes}</span>
                </button>
                {canRemove && (
                  <button
                    type="button"
                    className="vote-btn vote-btn--remove"
                    onClick={() => onRemoveVote(suggestion.id)}
                    aria-label={`Remove vote for ${suggestion.name}`}
                  >
                    <span className="vote-btn__icon" aria-hidden="true">−</span>
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
