import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Question } from '../types'
import { validateSuggestion } from '../utils/validateSuggestion'

interface SuggestionFormProps {
  questions: Question[]
  selectedQuestionId: string
  onQuestionChange: (questionId: string) => void
  onSubmitSuggestion: (suggestionText: string) => void | Promise<void>
}

export function SuggestionForm({
  questions,
  selectedQuestionId,
  onQuestionChange,
  onSubmitSuggestion,
}: SuggestionFormProps) {
  const [suggestion, setSuggestion] = useState('')
  const [validationError, setValidationError] = useState('')

  const handleChange = (value: string) => {
    setSuggestion(value)
    setValidationError(validateSuggestion(value))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedSuggestion = suggestion.trim()
    if (!trimmedSuggestion) {
      return
    }

    const error = validateSuggestion(trimmedSuggestion)
    if (error) {
      setValidationError(error)
      return
    }

    onSubmitSuggestion(trimmedSuggestion)
    setSuggestion('')
    setValidationError('')
  }

  return (
    <form className="suggestion-form" onSubmit={handleSubmit}>
      <h2>Submit name suggestions</h2>
      <div className="suggestion-form__row">
        <label htmlFor="question-select">Question</label>
        <select
          id="question-select"
          value={selectedQuestionId}
          onChange={(event) => onQuestionChange(event.target.value)}
        >
          {questions.map((question) => (
            <option key={question.id} value={question.id}>
              {question.title}
            </option>
          ))}
        </select>
      </div>
      <div className="suggestion-form__row">
        <label htmlFor="name-suggestion">Name suggestion</label>
        <input
          id="name-suggestion"
          value={suggestion}
          onChange={(event) => handleChange(event.target.value)}
          placeholder="e.g. Sunny Stride"
          maxLength={60}
          aria-describedby={validationError ? 'name-suggestion-error' : undefined}
          aria-invalid={!!validationError}
        />
        {validationError && (
          <span id="name-suggestion-error" className="suggestion-form__error" role="alert">
            {validationError}
          </span>
        )}
      </div>
      <button type="submit">Add suggestion</button>
    </form>
  )
}
