import { useState } from 'react'
import type { Question } from '../types'
import { handleImageError } from '../utils/imageError'
import { ImageLightbox } from './ImageLightbox'

interface QuestionCardProps {
  question: Question
}

export function QuestionCard({ question }: QuestionCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const imageUrl = question.imageUrl?.trim()
  const description = typeof question.description === 'string' ? question.description.trim() : ''

  return (
    <>
      <article className="question-card" aria-label={question.title}>
        {imageUrl && (
          <div className="question-card__image-wrap">
            <img
              src={imageUrl}
              alt={question.title}
              className="question-card__image"
              onClick={() => setLightboxOpen(true)}
              onError={handleImageError}
            />
          </div>
        )}
        <div className="question-card__body">
          <h3>{question.title}</h3>
          {description && <p>{description}</p>}
        </div>
      </article>

      {lightboxOpen && imageUrl && (
        <ImageLightbox
          src={imageUrl}
          alt={question.title}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  )
}
