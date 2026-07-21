import type { Campaign, Question, Suggestion } from '../types'

interface SuggestionBoardProps {
  campaign: Campaign
  questions: Question[]
  suggestions: Suggestion[]
  voteCountById: Map<string, number>
  onVote: (suggestionId: string, revoke: boolean) => void | Promise<void>
  isVoteDisabled?: (suggestionId: string) => boolean
}

export function SuggestionBoard({
  campaign,
  questions,
  suggestions,
  voteCountById,
  onVote,
  isVoteDisabled,
}: SuggestionBoardProps) {
  const usesSingleVoteButton = campaign.maxVotesPerCandidate === 1

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
                    const userVoteCount = voteCountById.get(suggestion.id) ?? 0
                    const hasVotes = userVoteCount > 0
                    const isDisabled = Boolean(isVoteDisabled?.(suggestion.id))
                    return (
                      <li key={suggestion.id} className="suggestion-card">
                        <span className="suggestion-card__name">{suggestion.name}</span>
                        <div className="vote-actions">
                          <button
                            type="button"
                            className={`vote-btn${usesSingleVoteButton && hasVotes ? ' vote-btn--voted' : ''}`}
                            onClick={() => onVote(suggestion.id, usesSingleVoteButton && hasVotes)}
                            disabled={usesSingleVoteButton ? false : isDisabled}
                            aria-pressed={usesSingleVoteButton && hasVotes}
                            aria-label={
                              usesSingleVoteButton && hasVotes
                                ? `Remove vote for ${suggestion.name}`
                                : `Vote for ${suggestion.name}`
                            }
                          >
                            <span className="vote-btn__icon" aria-hidden="true">▲</span>
                            <span className="vote-btn__count">{suggestion.votes}</span>
                          </button>
                          {!usesSingleVoteButton && hasVotes && (
                            <button
                              type="button"
                              className="vote-btn vote-btn--voted"
                              onClick={() => onVote(suggestion.id, true)}
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
