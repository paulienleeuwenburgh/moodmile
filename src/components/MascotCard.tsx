import type { Mascot } from '../types'

interface MascotCardProps {
  mascot: Mascot
  isSelected: boolean
  onSelect: (mascotId: string) => void
}

export function MascotCard({ mascot, isSelected, onSelect }: MascotCardProps) {
  return (
    <button
      type="button"
      className={`mascot-card${isSelected ? ' mascot-card--selected' : ''}`}
      onClick={() => onSelect(mascot.id)}
      aria-pressed={isSelected}
    >
      <img src={mascot.image} alt={mascot.title} className="mascot-card__image" />
      <h3>{mascot.title}</h3>
      <p>{mascot.description}</p>
    </button>
  )
}
