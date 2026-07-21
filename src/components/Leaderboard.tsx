import type { Campaign, Question, Suggestion } from '../types'

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
          const userVoteCount = voteCountById.get(suggestion.id) ?? 0
          const hasVotes = userVoteCount > 0
          const isDisabled = Boolean(isVoteDisabled?.(suggestion.id))
          const isVoteButtonDisabled = usesSingleVoteButton ? !hasVotes && isDisabled : isDisabled
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
              <div className="vote-actions">
                <button
                  type="button"
                  className={`vote-btn${usesSingleVoteButton && hasVotes ? ' vote-btn--voted' : ''}`}
                  onClick={() => onVote(suggestion.id, usesSingleVoteButton && hasVotes)}
                  disabled={isVoteButtonDisabled}
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
    </section>
  )
}
