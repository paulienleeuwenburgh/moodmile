export interface SuggestionVisibilityQuestion {
  questionType: string
  displaySubmissions?: boolean
  numberOfVotes?: number
}

/**
 * Determines whether all users' submissions should be shown for a text question,
 * as opposed to only the current user's own submissions.
 *
 * Rules:
 * - displaySubmissions defaults to true when unset (backwards compatible).
 * - When voting is enabled (numberOfVotes > 0), all submissions are always shown,
 *   overruling displaySubmissions=false.
 */
export function shouldDisplayAllSubmissions(question: SuggestionVisibilityQuestion): boolean {
  if (question.questionType !== 'text') {
    return true
  }
  const allowVoting = (question.numberOfVotes ?? 0) > 0
  if (allowVoting) {
    return true
  }
  return question.displaySubmissions !== false
}
