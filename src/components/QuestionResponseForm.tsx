import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Question, QuestionResponse } from '../types'

interface QuestionResponseFormProps {
  question: Question
  onSubmit: (answer: QuestionResponse['answer']) => void | Promise<void>
}

export function QuestionResponseForm({ question, onSubmit }: QuestionResponseFormProps) {
  const [textValue, setTextValue] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [booleanValue, setBooleanValue] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let answer: QuestionResponse['answer']
    if (question.questionType === 'boolean' && booleanValue === '') {
      setError('Please choose yes or no.')
      return
    }
    switch (question.questionType) {
      case 'categorical-single':
      case 'ordinal':
        answer = selected[0] ?? ''
        break
      case 'categorical-multiple':
        answer = selected
        break
      case 'boolean':
        answer = booleanValue === 'true'
        break
      case 'numeric':
        answer = textValue.trim() ? Number(textValue) : Number.NaN
        break
      case 'text':
        answer = textValue
        break
    }

    if (
      answer === '' ||
      (Array.isArray(answer) && answer.length === 0) ||
      (typeof answer === 'number' && !Number.isFinite(answer)) ||
      (question.questionType === 'text' && typeof answer === 'string' && !answer.trim())
    ) {
      setError('Please provide an answer.')
      return
    }
    if (typeof answer === 'number' && question.numericMin !== undefined && answer < question.numericMin) {
      setError(`Enter a number of at least ${question.numericMin}.`)
      return
    }
    if (typeof answer === 'number' && question.numericMax !== undefined && answer > question.numericMax) {
      setError(`Enter a number no greater than ${question.numericMax}.`)
      return
    }
    if (typeof answer === 'string' && Array.from(answer).length > 250) {
      setError('Answers can be up to 250 characters long.')
      return
    }
    if (typeof answer === 'string' && /[<>]/u.test(answer)) {
      setError('Answers cannot contain angle brackets.')
      return
    }

    setError('')
    await onSubmit(answer)
    setTextValue('')
    setSelected([])
    setBooleanValue('')
  }

  return (
    <form className="suggestion-form" onSubmit={(event) => void handleSubmit(event)}>
      <h2>Your answer</h2>
      {question.questionType === 'categorical-single' || question.questionType === 'ordinal' ? (
        <fieldset>
          <legend>{question.title}</legend>
          {question.options?.map((option) => (
            <label key={option}>
              <input
                type="radio"
                name={`answer-${question.id}`}
                value={option}
                checked={selected[0] === option}
                onChange={() => setSelected([option])}
              />
              {option}
            </label>
          ))}
        </fieldset>
      ) : null}
      {question.questionType === 'categorical-multiple' ? (
        <fieldset>
          <legend>{question.title}</legend>
          {question.options?.map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                value={option}
                checked={selected.includes(option)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, option]
                      : current.filter((value) => value !== option),
                  )
                }
              />
              {option}
            </label>
          ))}
        </fieldset>
      ) : null}
      {question.questionType === 'boolean' && (
        <div className="suggestion-form__row">
          <label htmlFor={`answer-${question.id}`}>{question.title}</label>
          <select
            id={`answer-${question.id}`}
            value={booleanValue}
            onChange={(event) => setBooleanValue(event.target.value)}
          >
            <option value="">Select an answer</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      )}
      {question.questionType === 'numeric' && (
        <div className="suggestion-form__row">
          <label htmlFor={`answer-${question.id}`}>{question.title}</label>
          <input
            id={`answer-${question.id}`}
            type="number"
            min={question.numericMin}
            max={question.numericMax}
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
          />
        </div>
      )}
      {question.questionType === 'text' && (
        <div className="suggestion-form__row">
          <label htmlFor={`answer-${question.id}`}>{question.title}</label>
          <input
            id={`answer-${question.id}`}
            maxLength={250}
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
          />
        </div>
      )}
      {error && <span className="suggestion-form__error" role="alert">{error}</span>}
      <button type="submit">Submit answer</button>
    </form>
  )
}
