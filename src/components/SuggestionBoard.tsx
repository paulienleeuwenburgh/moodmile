import type { Question, Suggestion } from '../types'

interface SuggestionBoardProps {
  questions: Question[]
  suggestions: Suggestion[]
  votedIds: Set<string>
  onVote: (suggestionId: string) => void | Promise<void>
  isVoteDisabled?: (suggestionId: string) => boolean
}

export function SuggestionBoard({
  questions,
  suggestions,
  votedIds,
  onVote,
  isVoteDisabled,
}: SuggestionBoardProps) {
  return (
    <section className="suggestion-board" aria-label="Suggestions by question">
      <h2>Suggestions by question</h2>
      <div className="suggestion-board__grid">
        {questions.map((question) => {
          const questionSuggestions = suggestions
            .filter((suggestion) => suggestion.questionId === question.id)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

          return (
            <article key={question.id} className="suggestion-group">
              <header>
                {question.imageUrl && <img src={question.imageUrl} alt="" aria-hidden="true" />}
                <h3>{question.title}</h3>
              </header>
              {questionSuggestions.length === 0 ? (
                <p className="suggestion-group__empty">No suggestions yet — be the first!</p>
              ) : (
                <ul>
                  {questionSuggestions.map((suggestion) => {
                    const hasVoted = votedIds.has(suggestion.id)
                    const isDisabled = !hasVoted && Boolean(isVoteDisabled?.(suggestion.id))
                    return (
                      <li key={suggestion.id} className="suggestion-card">
                        <span className="suggestion-card__name">{suggestion.name}</span>
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
                </ul>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
