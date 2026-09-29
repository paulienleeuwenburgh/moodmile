import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Question, QuestionResponse } from '../types'

interface QuestionResponseFormProps {
  question: Question
  onSubmit: (answer?: QuestionResponse['answer']) => boolean | void | Promise<boolean | void>
}

export function QuestionResponseForm({ question, onSubmit }: QuestionResponseFormProps) {
  const [textValue, setTextValue] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [booleanValue, setBooleanValue] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let answer: QuestionResponse['answer'] | undefined
    switch (question.questionType) {
      case 'categorical':
        answer = selected
        break
      case 'ordinal':
        answer = selected[0] ?? ''
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
      (question.questionType === 'text' && typeof answer === 'string' && !answer.trim()) ||
      (question.questionType === 'boolean' && booleanValue === '')
    ) {
      if (question.required) {
        setError('Please provide an answer.')
        return
      }
      answer = undefined
    }
    if (typeof answer === 'number' && question.numericMin !== undefined && answer < question.numericMin) {
      setError(`Enter a number of at least ${question.numericMin}.`)
      return
    }
    if (typeof answer === 'number' && question.numericMax !== undefined && answer > question.numericMax) {
      setError(`Enter a number no greater than ${question.numericMax}.`)
      return
    }
    const maxSize = question.maxSize ?? 250
    if (typeof answer === 'string' && Array.from(answer).length > maxSize) {
      setError(`Answers can be up to ${maxSize} characters long.`)
      return
    }
    if (typeof answer === 'string' && /[<>]/u.test(answer)) {
      setError('Answers cannot contain angle brackets.')
      return
    }

    setError('')
    const submitted = await onSubmit(answer)
    if (submitted === false) return
    setTextValue('')
    setSelected([])
    setBooleanValue('')
  }

  return (
    <form className="suggestion-form" onSubmit={(event) => void handleSubmit(event)}>
      <h2>Your answer</h2>
      {question.questionType === 'categorical' || question.questionType === 'ordinal' ? (
        <fieldset>
          <legend>{question.title}{question.required ? ' (required)' : ''}</legend>
          {question.questionType === 'categorical' && (question.numberOfVotes ?? 1) > 1 && (
            <p className="question-response__instructions">
              Submit {question.numberOfVotes} votes
              {question.duplicateVotingAllowed ? ', multiple votes per answer allowed' : ''}
            </p>
          )}
          <ul className="question-response__options">
            {question.options?.map((option) => {
              const allowsRepeatedVotes =
                question.questionType === 'categorical' &&
                (question.numberOfVotes ?? 1) > 1 &&
                question.duplicateVotingAllowed
              if (allowsRepeatedVotes) {
                const quantity = selected.filter((value) => value === option).length
                const maxQuantity = (question.numberOfVotes ?? 1) - selected.length + quantity
                return (
                  <li key={option} className="question-response__option question-response__option--votes">
                    <span>{option}</span>
                    <input
                      type="number"
                      min={0}
                      max={maxQuantity}
                      value={quantity}
                      aria-label={`${option} votes`}
                      onChange={(event) => {
                        const nextQuantity = Math.max(0, Number(event.target.value) || 0)
                        setSelected((current) => [
                          ...current.filter((value) => value !== option),
                          ...Array.from(
                            { length: Math.min(nextQuantity, (question.numberOfVotes ?? 1) - current.length + current.filter((value) => value === option).length) },
                            () => option,
                          ),
                        ])
                      }}
                    />
                  </li>
                )
              }
              return (
                <li key={option} className="question-response__option">
                  <label>
                    <input
                      type={question.questionType === 'ordinal' || (question.numberOfVotes ?? 1) === 1 ? 'radio' : 'checkbox'}
                      name={`answer-${question.id}`}
                      value={option}
                      checked={selected.includes(option)}
                      disabled={
                        question.questionType === 'categorical' &&
                        (question.numberOfVotes ?? 1) > 1 &&
                        !selected.includes(option) &&
                        selected.length >= (question.numberOfVotes ?? 1)
                      }
                      onChange={(event) => {
                        if (question.questionType === 'ordinal' || (question.numberOfVotes ?? 1) === 1) {
                          setSelected([option])
                        } else if (event.target.checked) {
                          setSelected((current) => [...current, option])
                        } else {
                          setSelected((current) => current.filter((value) => value !== option))
                        }
                      }}
                    />
                    {option}
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>
      ) : null}
      {question.questionType === 'boolean' && (
        <div className="suggestion-form__row">
          <label htmlFor={`answer-${question.id}`}>{question.title}{question.required ? ' (required)' : ''}</label>
          <select
            id={`answer-${question.id}`}
            value={booleanValue}
            required={question.required}
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
          <label htmlFor={`answer-${question.id}`}>{question.title}{question.required ? ' (required)' : ''}</label>
          <input
            id={`answer-${question.id}`}
            type="number"
            step="any"
            min={question.numericMin}
            max={question.numericMax}
            required={question.required}
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
          />
        </div>
      )}
      {question.questionType === 'text' && (
        <div className="suggestion-form__row">
          <label htmlFor={`answer-${question.id}`}>{question.title}{question.required ? ' (required)' : ''}</label>
          <input
            id={`answer-${question.id}`}
            value={textValue}
            required={question.required}
            onChange={(event) => setTextValue(event.target.value)}
          />
        </div>
      )}
      {error && <span className="suggestion-form__error" role="alert">{error}</span>}
      <button type="submit">Submit answer</button>
    </form>
  )
}
