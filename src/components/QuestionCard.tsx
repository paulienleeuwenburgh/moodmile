import type { Question } from '../types'

interface QuestionCardProps {
  question: Question
  isSelected: boolean
  onSelect: (questionId: string) => void
}

export function QuestionCard({ question, isSelected, onSelect }: QuestionCardProps) {
  return (
    <button
      type="button"
      className={`question-card${isSelected ? ' question-card--selected' : ''}`}
      onClick={() => onSelect(question.id)}
      aria-pressed={isSelected}
    >
      <div className="question-card__image-wrap">
        {question.imageUrl && (
          <img
            src={question.imageUrl}
            alt={question.title}
            className="question-card__image"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        )}
      </div>
      <div className="question-card__body">
        <h3>{question.title}</h3>
        <p>{question.description}</p>
      </div>
    </button>
  )
}
