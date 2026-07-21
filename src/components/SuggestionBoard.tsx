import type { Question, Suggestion } from '../types'

interface SuggestionBoardProps {
  questions: Question[]
  suggestions: Suggestion[]
  onVote: (suggestionId: string) => void | Promise<void>
  onRemoveVote: (suggestionId: string) => void | Promise<void>
  canRemoveVote?: (suggestionId: string) => boolean
  isVoteDisabled?: (suggestionId: string) => boolean
}

export function SuggestionBoard({
  questions,
  suggestions,
  onVote,
  onRemoveVote,
  canRemoveVote,
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
                    const canRemove = Boolean(canRemoveVote?.(suggestion.id))
                    const isDisabled = Boolean(isVoteDisabled?.(suggestion.id))
                    return (
                      <li key={suggestion.id} className="suggestion-card">
                        <span className="suggestion-card__name">{suggestion.name}</span>
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
                </ul>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
