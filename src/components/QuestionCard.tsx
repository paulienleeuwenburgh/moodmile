import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import type { Question } from '../types'
import { handleImageError } from '../utils/imageError'
import { ImageLightbox } from './ImageLightbox'

interface QuestionCardProps {
  question: Question
  isSelected: boolean
  onSelect: (questionId: string) => void
}

const PORTRAIT_RATIO_THRESHOLD = 0.9
const SQUARE_RATIO_THRESHOLD = 1.15

export function QuestionCard({ question, isSelected, onSelect }: QuestionCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [imageVariant, setImageVariant] = useState<'landscape' | 'portrait' | 'square'>('landscape')

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
                onLoad={handleImageLoad}
                onError={(event) => {
                  setImageVariant('landscape')
                  handleImageError(event)
                }}
              />
              <button
                type="button"
                className="question-card__expand-btn"
                onClick={() => setLightboxOpen(true)}
                aria-label={`View larger image for ${question.title}`}
              >
                {/* Expand / fullscreen icon */}
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="13" height="13">
                  <path
                    d="M10 2h4v4M6 14H2v-4M14 10v4h-4M2 6V2h4"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          ) : null}
        </div>
        <button
          type="button"
          className="question-card__select-btn"
          onClick={() => onSelect(question.id)}
          aria-pressed={isSelected}
        >
          <div className="question-card__body">
            <h3>{question.title}</h3>
            <p>{question.description}</p>
          </div>
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
