import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Question } from '../types'
import {
  countSuggestionCharacters,
  SUGGESTION_MAX_LENGTH,
  validateSuggestion,
} from '../utils/validateSuggestion'

interface SuggestionFormProps {
  question: Question
  onSubmitSuggestion: (suggestionText: string) => void | Promise<void>
}

export function SuggestionForm({
  question,
  onSubmitSuggestion,
}: SuggestionFormProps) {
  const [suggestion, setSuggestion] = useState('')
  const [validationError, setValidationError] = useState('')
  const maxSize = question.maxSize ?? SUGGESTION_MAX_LENGTH
  const remainingCharacters = maxSize - countSuggestionCharacters(suggestion)
  const countId = `name-suggestion-count-${question.id}`
  const errorId = `name-suggestion-error-${question.id}`
  const characterCountMessage = remainingCharacters < 0
    ? `${Math.abs(remainingCharacters)} character${Math.abs(remainingCharacters) === 1 ? '' : 's'} over limit`
    : `${remainingCharacters} character${remainingCharacters === 1 ? '' : 's'} left`
  const describedBy = validationError
    ? `${countId} ${errorId}`
    : countId

  const handleChange = (value: string) => {
    setSuggestion(value)
    setValidationError(validateSuggestion(value, maxSize))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedSuggestion = suggestion.trim()
    if (!trimmedSuggestion && !question.required) {
      return
    }

    if (!trimmedSuggestion) {
      setValidationError('Please provide an answer.')
      return
    }

    const error = validateSuggestion(trimmedSuggestion, maxSize)
    if (error) {
      setValidationError(error)
      return
    }

    onSubmitSuggestion(trimmedSuggestion)
    setSuggestion('')
    setValidationError('')
  }

  return (
    <form className="suggestion-form" onSubmit={handleSubmit} aria-label={`Answer ${question.title}`}>
      <h2>Your answer</h2>
      <div className="suggestion-form__row">
        <label htmlFor={`name-suggestion-${question.id}`}>Your answer{question.required ? ' (required)' : ''}</label>
        <input
          id={`name-suggestion-${question.id}`}
          value={suggestion}
          onChange={(event) => handleChange(event.target.value)}
          placeholder="e.g. Sunny Stride"
          required={question.required}
          aria-describedby={describedBy}
          aria-invalid={!!validationError}
        />
        <span
          id={countId}
          className={`suggestion-form__count${remainingCharacters < 0 ? ' suggestion-form__count--invalid' : ''}`}
        >
          {characterCountMessage}
        </span>
        {validationError && (
          <span id={errorId} className="suggestion-form__error" role="alert">
            {validationError}
          </span>
        )}
      </div>
      <button type="submit">Submit</button>
    </form>
  )
}
