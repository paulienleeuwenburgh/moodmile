interface VotingRulesProps {
  maxVotesTotal: number
  maxVotesPerCategory: number
  maxVotesPerCandidate: number
  questionCount: number
  votesUsed: number
}

export function VotingRules({
  maxVotesTotal,
  maxVotesPerCategory,
  maxVotesPerCandidate,
  questionCount,
  votesUsed,
}: VotingRulesProps) {
  const remaining = maxVotesTotal > 0 ? Math.max(0, maxVotesTotal - votesUsed) : null
  const hideAllConstraints =
    maxVotesTotal > 0 &&
    maxVotesTotal === maxVotesPerCandidate &&
    maxVotesTotal === maxVotesPerCategory
  const hidePerCandidateConstraint =
    hideAllConstraints ||
    (questionCount === 1 &&
      maxVotesPerCandidate === 1 &&
      maxVotesPerCategory === 1)
  const hidePerCategoryConstraint =
    hideAllConstraints ||
    (questionCount === 1 &&
      maxVotesTotal > 0 &&
      maxVotesPerCategory > 0 &&
      maxVotesPerCategory === maxVotesTotal)

  const constraints: string[] = []
  if (!hidePerCandidateConstraint && maxVotesPerCandidate > 0) {
    constraints.push(
      maxVotesPerCandidate === 1
        ? 'One vote per candidate'
        : `Up to ${maxVotesPerCandidate} votes per candidate`,
    )
  }
  if (!hidePerCategoryConstraint && maxVotesPerCategory > 0) {
    constraints.push(
      maxVotesPerCategory === 1
        ? 'One vote per category'
        : `Up to ${maxVotesPerCategory} votes per category`,
    )
  }

  if (remaining === null && constraints.length === 0) return null

  return (
    <aside className="voting-rules" aria-label="Voting rules">
      {remaining !== null && (
        <div className="voting-rules__remaining">
          <span className="voting-rules__remaining-count">
            {remaining}
          </span>
          <span className="voting-rules__remaining-label" aria-hidden="true">
            {' '}of {maxVotesTotal} total vote{maxVotesTotal !== 1 ? 's' : ''} remaining
          </span>
        </div>
      )}
      {constraints.length > 0 && (
        <ul className="voting-rules__list">
          {constraints.map((rule) => (
            <li key={rule} className="voting-rules__item">
              {rule}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
