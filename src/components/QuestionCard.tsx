import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import type { Question } from '../types'
import { handleImageError } from '../utils/imageError'
import { ImageLightbox } from './ImageLightbox'

interface QuestionCardProps {
  question: Question
}

// 0.9 ~= 9:10; anything narrower is treated as portrait.
const PORTRAIT_RATIO_THRESHOLD = 0.9
// Up to 1.15 keeps near-square images out of the wide landscape treatment.
const SQUARE_RATIO_THRESHOLD = 1.15

export function QuestionCard({ question }: QuestionCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [imageVariant, setImageVariant] = useState<'landscape' | 'portrait' | 'square'>('landscape')
  const imageUrl = question.imageUrl?.trim()
  const description = typeof question.description === 'string' ? question.description.trim() : ''

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
      <article className="question-card" aria-label={question.title}>
        {imageUrl && (
          <div className={`question-card__image-wrap question-card__image-wrap--${imageVariant}`}>
            <img
              src={imageUrl}
              alt={question.title}
              className={`question-card__image question-card__image--${imageVariant}`}
              onClick={() => setLightboxOpen(true)}
              onLoad={handleImageLoad}
              onError={(event) => {
                setImageVariant('landscape')
                handleImageError(event)
              }}
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
