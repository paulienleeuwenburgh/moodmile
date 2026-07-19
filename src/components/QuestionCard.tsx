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
      className={`mascot-card${isSelected ? ' mascot-card--selected' : ''}`}
      onClick={() => onSelect(question.id)}
      aria-pressed={isSelected}
    >
      <div className="mascot-card__image-wrap">
        {question.imageUrl && (
          <img src={question.imageUrl} alt={question.title} className="mascot-card__image" />
        )}
      </div>
      <div className="mascot-card__body">
        <h3>{question.title}</h3>
        <p>{question.description}</p>
      </div>
    </button>
  )
}
