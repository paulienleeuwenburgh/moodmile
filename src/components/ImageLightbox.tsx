import { useEffect } from 'react'

interface ImageLightboxProps {
  src: string
  alt: string
  onClose: () => void
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="lightbox-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Enlarged image: ${alt}`}
    >
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className="lightbox-img" />
        <button
          type="button"
          className="lightbox-close"
          onClick={onClose}
          aria-label="Close enlarged image"
        >
          {/* × close icon */}
          <svg viewBox="0 0 14 14" fill="none" aria-hidden="true" width="12" height="12">
            <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
