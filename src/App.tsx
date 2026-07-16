import { useEffect, useState } from 'react'
import './App.css'
import { MascotCard } from './components/MascotCard'
import { SuggestionBoard } from './components/SuggestionBoard'
import { SuggestionForm } from './components/SuggestionForm'
import { mascots } from './data/mascots'
import type { Suggestion } from './types'
import { loadSuggestions, saveSuggestions } from './utils/suggestionsStorage'

const getSuggestionId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `suggestion-${Date.now()}-${Math.random().toString(36).slice(2)}`

function App() {
  const [selectedMascotId, setSelectedMascotId] = useState(mascots[0]?.id ?? '')
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => loadSuggestions())

  useEffect(() => {
    saveSuggestions(suggestions)
  }, [suggestions])

  const handleSuggestionSubmit = (name: string) => {
    if (!selectedMascotId) {
      return
    }

    setSuggestions((currentSuggestions) => [
      ...currentSuggestions,
      {
        id: getSuggestionId(),
        mascotId: selectedMascotId,
        name,
        createdAt: new Date().toISOString(),
      },
    ])
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="hero__eyebrow">MoodMile</p>
        <h1>Help us name our next mascot</h1>
        <p>
          Pick your favorite mascot and drop as many name ideas as you want. Every
          suggestion is saved in your browser.
        </p>
      </section>

      <section className="mascots" aria-label="Mascot options">
        {mascots.map((mascot) => (
          <MascotCard
            key={mascot.id}
            mascot={mascot}
            isSelected={selectedMascotId === mascot.id}
            onSelect={setSelectedMascotId}
          />
        ))}
      </section>

      <SuggestionForm
        mascots={mascots}
        selectedMascotId={selectedMascotId}
        onMascotChange={setSelectedMascotId}
        onSubmitSuggestion={handleSuggestionSubmit}
      />

      <SuggestionBoard mascots={mascots} suggestions={suggestions} />
    </main>
  )
}

export default App
