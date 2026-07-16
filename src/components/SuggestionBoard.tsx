import type { Mascot, Suggestion } from '../types'

interface SuggestionBoardProps {
  mascots: Mascot[]
  suggestions: Suggestion[]
}

export function SuggestionBoard({ mascots, suggestions }: SuggestionBoardProps) {
  return (
    <section className="suggestion-board" aria-label="Suggestions by mascot">
      <h2>Suggestions by mascot</h2>
      <div className="suggestion-board__grid">
        {mascots.map((mascot) => {
          const mascotSuggestions = suggestions
            .filter((suggestion) => suggestion.mascotId === mascot.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

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
                  {mascotSuggestions.map((suggestion) => (
                    <li key={suggestion.id} className="suggestion-card">
                      {suggestion.name}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
