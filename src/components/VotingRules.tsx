interface VotingRulesProps {
  maxVotesTotal: number
  maxVotesPerCategory: number
  maxVotesPerCandidate: number
  votesUsed: number
}

export function VotingRules({
  maxVotesTotal,
  maxVotesPerCategory,
  maxVotesPerCandidate,
  votesUsed,
}: VotingRulesProps) {
  const rules: string[] = []

  if (maxVotesPerCandidate > 0) {
    rules.push(
      maxVotesPerCandidate === 1
        ? 'One vote per candidate'
        : `Up to ${maxVotesPerCandidate} votes per candidate`,
    )
  }

  if (maxVotesPerCategory > 0) {
    rules.push(
      maxVotesPerCategory === 1
        ? 'One vote per category'
        : `Up to ${maxVotesPerCategory} votes per category`,
    )
  }

  if (maxVotesTotal > 0) {
    const remaining = Math.max(0, maxVotesTotal - votesUsed)
    rules.push(`${remaining} of ${maxVotesTotal} total vote${maxVotesTotal !== 1 ? 's' : ''} remaining`)
  }

  if (rules.length === 0) return null

  return (
    <aside className="voting-rules" aria-label="Voting rules">
      <ul className="voting-rules__list">
        {rules.map((rule) => (
          <li key={rule} className="voting-rules__item">
            {rule}
          </li>
        ))}
      </ul>
    </aside>
  )
}
