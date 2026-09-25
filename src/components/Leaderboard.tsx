import type { Campaign, Question, Suggestion } from '../types'
import { handleImageError } from '../utils/imageError'

interface LeaderboardProps {
  campaign: Campaign
  questions: Question[]
  suggestions: Suggestion[]
  voteCountById: Map<string, number>
  onVote: (suggestionId: string, revoke: boolean) => void | Promise<void>
  isVoteDisabled?: (suggestionId: string) => boolean
}

export function Leaderboard({
  campaign,
  questions,
  suggestions,
  voteCountById,
  onVote,
  isVoteDisabled,
}: LeaderboardProps) {
  const ranked = [...suggestions].sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt))
  const usesSingleVoteButton = campaign.maxVotesPerCandidate === 1
  const showQuestionImages = questions.length > 1

  if (ranked.length === 0) {
    return null
  }

  const questionById = Object.fromEntries(questions.map((q) => [q.id, q]))
  const hasAnyVotes = ranked.some((s) => s.votes > 0)

  return (
    <section className="leaderboard" aria-label="Leaderboard">
      <span className="section-eyebrow" aria-hidden="true">Rankings</span>
      <h2>Leaderboard</h2>
      {!hasAnyVotes ? (
        <div className="empty-state">
          {/* Bar chart / no data icon */}
          <svg className="empty-state__icon" viewBox="0 0 48 48" fill="none" aria-hidden="true" width="52" height="52">
            <rect x="6" y="30" width="8" height="12" rx="2" stroke="currentColor" strokeWidth="2.5" />
            <rect x="20" y="22" width="8" height="20" rx="2" stroke="currentColor" strokeWidth="2.5" />
            <rect x="34" y="14" width="8" height="28" rx="2" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3 3" />
            <path d="M4 45h40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <p className="empty-state__title">No votes yet</p>
          <p className="empty-state__desc">Cast the first vote to start the rankings!</p>
        </div>
      ) : (
        <ol className="leaderboard__list">
          {ranked.map((suggestion, index) => {
            const question = questionById[suggestion.questionId]
            const userVoteCount = voteCountById.get(suggestion.id) ?? 0
            const hasVotes = userVoteCount > 0
            const isDisabled = Boolean(isVoteDisabled?.(suggestion.id))
            const isAddVoteButtonDisabled = usesSingleVoteButton ? !hasVotes && isDisabled : isDisabled
            return (
              <li key={suggestion.id} className="leaderboard-entry">
                <span className="leaderboard-entry__rank" aria-label={`Rank ${index + 1}`}>
                  {index + 1}
                </span>
                {showQuestionImages && question?.imageUrl && (
                  <img
                    src={question.imageUrl}
                    alt=""
                    aria-hidden="true"
                    className="leaderboard-entry__mascot"
                    onError={handleImageError}
                  />
                )}
                <span className="leaderboard-entry__name">{suggestion.name}</span>
                {question && (
                  <span className="leaderboard-entry__mascot-title">{question.title}</span>
                )}
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
        </ol>
      )}
    </section>
  )
}
