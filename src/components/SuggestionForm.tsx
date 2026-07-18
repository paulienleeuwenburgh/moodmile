import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Mascot } from '../types'
import { validateSuggestion } from '../utils/validateSuggestion'

interface SuggestionFormProps {
  mascots: Mascot[]
  selectedMascotId: string
  onMascotChange: (mascotId: string) => void
  onSubmitSuggestion: (suggestionText: string) => void | Promise<void>
}

export function SuggestionForm({
  mascots,
  selectedMascotId,
  onMascotChange,
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
      <h2>Submit mascot name suggestions</h2>
      <div className="suggestion-form__row">
        <label htmlFor="mascot-select">Mascot</label>
        <select
          id="mascot-select"
          value={selectedMascotId}
          onChange={(event) => onMascotChange(event.target.value)}
        >
          {mascots.map((mascot) => (
            <option key={mascot.id} value={mascot.id}>
              {mascot.title}
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
