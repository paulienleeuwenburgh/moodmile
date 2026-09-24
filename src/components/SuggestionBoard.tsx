import type { Campaign, Question, Suggestion } from '../types'
import { handleImageError } from '../utils/imageError'

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
    <section className="suggestion-board" aria-label={campaign.allowSuggestions ? 'Suggestions by question' : 'Submissions by question'}>
      <span className="section-eyebrow" aria-hidden="true">Submissions</span>
      <h2>{campaign.allowSuggestions ? 'Suggestions by question' : 'Submissions by question'}</h2>
      <div className="suggestion-board__grid">
        {questions.map((question) => {
          const questionSuggestions = suggestions
            .filter((suggestion) => suggestion.questionId === question.id)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

          return (
            <article key={question.id} className="suggestion-group">
              <header>
                {question.imageUrl && (
                  <img
                    src={question.imageUrl}
                    alt=""
                    aria-hidden="true"
                    onError={handleImageError}
                  />
                )}
                <h3>{question.title}</h3>
              </header>
              {questionSuggestions.length === 0 ? (
                <p className="suggestion-group__empty">
                  {/* Empty inbox icon */}
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="14" height="14" style={{ flexShrink: 0 }}>
                    <rect x="1.5" y="5.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
                    <path d="M1.5 9.5h3.25L6 11.5h4l1.25-2H14.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5.5 3L8 1l2.5 2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 1v5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                  </svg>
                  {campaign.allowSuggestions
                    ? 'No submissions yet — be the first!'
                    : 'Submissions are closed for this question.'}
                </p>
              ) : (
                <ul>
                  {questionSuggestions.map((suggestion) => {
                    const userVoteCount = voteCountById.get(suggestion.id) ?? 0
                    const hasVotes = userVoteCount > 0
                    const isDisabled = Boolean(isVoteDisabled?.(suggestion.id))
                    const isAddVoteButtonDisabled = usesSingleVoteButton ? !hasVotes && isDisabled : isDisabled
                    return (
                      <li key={suggestion.id} className="suggestion-card">
                        <span className="suggestion-card__name">{suggestion.name}</span>
                        <div className="vote-actions">
                          <button
                            type="button"
                            className={`vote-btn${usesSingleVoteButton && hasVotes ? ' vote-btn--voted' : ''}`}
                            onClick={() => onVote(suggestion.id, usesSingleVoteButton && hasVotes)}
                            disabled={isAddVoteButtonDisabled}
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
