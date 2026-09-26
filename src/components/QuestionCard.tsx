import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import type { Question } from '../types'
import { handleImageError } from '../utils/imageError'
import { ImageLightbox } from './ImageLightbox'

interface QuestionCardProps {
  question: Question
  isSelected: boolean
  onSelect: (questionId: string) => void
  hideTitle?: boolean
}

// 0.9 ~= 9:10; anything narrower is treated as portrait.
const PORTRAIT_RATIO_THRESHOLD = 0.9
// Up to 1.15 keeps near-square images out of the wide landscape treatment.
const SQUARE_RATIO_THRESHOLD = 1.15

export function QuestionCard({ question, isSelected, onSelect, hideTitle = false }: QuestionCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [imageVariant, setImageVariant] = useState<'landscape' | 'portrait' | 'square'>('landscape')
  const shouldShowTitle = !hideTitle
  const description = typeof question.description === 'string' ? question.description.trim() : ''
  const shouldShowDescription = description.length > 0

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget
    if (!naturalWidth || !naturalHeight) {
      setImageVariant('landscape')
      return
    }

    const ratio = naturalWidth / naturalHeight
    if (ratio < PORTRAIT_RATIO_THRESHOLD) {
      setImageVariant('portrait')
      return
    }
    if (ratio <= SQUARE_RATIO_THRESHOLD) {
      setImageVariant('square')
      return
    }
    setImageVariant('landscape')
  }

  return (
    <>
      {/*
        Outer element is an article, not a button, so we can nest two
        separate buttons inside: one for expanding the image and one for
        selecting the question — avoiding invalid nested-button HTML.
      */}
      <article
        className={`question-card${isSelected ? ' question-card--selected' : ''}`}
        aria-label={question.title}
      >
        <div className={`question-card__image-wrap question-card__image-wrap--${imageVariant}`}>
          {question.imageUrl ? (
            <>
              <img
                src={question.imageUrl}
                alt={question.title}
                className={`question-card__image question-card__image--${imageVariant}`}
                onClick={() => setLightboxOpen(true)}
                onLoad={handleImageLoad}
                onError={(event) => {
                  setImageVariant('landscape')
                  handleImageError(event)
                }}
              />
            </>
          ) : null}
        </div>
        <button
          type="button"
          className="question-card__select-btn"
          onClick={() => onSelect(question.id)}
          aria-pressed={isSelected}
        >
          {(shouldShowTitle || shouldShowDescription) && (
            <div className="question-card__body">
              {shouldShowTitle && <h3>{question.title}</h3>}
              {shouldShowDescription && <p>{description}</p>}
            </div>
          )}
        </button>
      </article>

      {lightboxOpen && question.imageUrl && (
        <ImageLightbox
          src={question.imageUrl}
          alt={question.title}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  )
}
