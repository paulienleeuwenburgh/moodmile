import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Mascot } from '../types'

interface SuggestionFormProps {
  mascots: Mascot[]
  selectedMascotId: string
  onMascotChange: (mascotId: string) => void
  onSubmitSuggestion: (suggestionText: string) => void
}

export function SuggestionForm({
  mascots,
  selectedMascotId,
  onMascotChange,
  onSubmitSuggestion,
}: SuggestionFormProps) {
  const [suggestion, setSuggestion] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedSuggestion = suggestion.trim()
    if (!trimmedSuggestion) {
      return
    }

    onSubmitSuggestion(trimmedSuggestion)
    setSuggestion('')
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
          onChange={(event) => setSuggestion(event.target.value)}
          placeholder="e.g. Sunny Stride"
          maxLength={60}
        />
      </div>
      <button type="submit">Add suggestion</button>
    </form>
  )
}
