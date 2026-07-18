import type { Mascot, Suggestion } from '../types'

interface SuggestionBoardProps {
  mascots: Mascot[]
  suggestions: Suggestion[]
  votedIds: Set<string>
  onVote: (suggestionId: string) => void | Promise<void>
}

export function SuggestionBoard({ mascots, suggestions, votedIds, onVote }: SuggestionBoardProps) {
  return (
    <section className="suggestion-board" aria-label="Suggestions by mascot">
      <h2>Suggestions by mascot</h2>
      <div className="suggestion-board__grid">
        {mascots.map((mascot) => {
          const mascotSuggestions = suggestions
            .filter((suggestion) => suggestion.mascotId === mascot.id)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

          return (
            <article key={mascot.id} className="suggestion-group">
              <header>
                <img src={mascot.image} alt="" aria-hidden="true" />
                <h3>{mascot.title}</h3>
              </header>
              {mascotSuggestions.length === 0 ? (
                <p className="suggestion-group__empty">No suggestions yet — be the first!</p>
              ) : (
                <ul>
                  {mascotSuggestions.map((suggestion) => {
                    const hasVoted = votedIds.has(suggestion.id)
                    return (
                      <li key={suggestion.id} className="suggestion-card">
                        <span className="suggestion-card__name">{suggestion.name}</span>
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
                </ul>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
