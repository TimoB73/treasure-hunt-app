import { useState, type FormEvent } from 'react'
import type { LatLng } from '../lib/geo'
import { searchPlaces, type Place } from '../lib/geocode'

interface Props {
  /** Wird mit dem gewählten Ort aufgerufen */
  onSelect: (position: LatLng) => void
  placeholder: string
}

/** Adresse oder Ort suchen, z. B. um eine Jagd von zu Hause aus für einen anderen Ort zu planen */
export function PlaceSearch({ onSelect, placeholder }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setResults(await searchPlaces(query))
    } catch {
      setError('Die Ortssuche ist gerade nicht erreichbar – bitte auf der Karte tippen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-2">
      <form onSubmit={search} className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          enterKeyHint="search"
          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-transparent px-3 py-2 text-sm dark:border-stone-700"
        />
        <button
          type="submit"
          disabled={busy || query.trim().length < 3}
          className="shrink-0 rounded-xl border border-stone-300 px-3 py-2 text-sm font-medium disabled:opacity-40 dark:border-stone-700"
        >
          {busy ? '…' : '🔍 Suchen'}
        </button>
      </form>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {results && results.length === 0 && <p className="mt-1 text-sm text-stone-500">Nichts gefunden – anders schreiben?</p>}
      {results && results.length > 0 && (
        <ul className="mt-1 divide-y divide-stone-200 rounded-xl border border-stone-200 text-sm dark:divide-stone-800 dark:border-stone-800">
          {results.map((r) => (
            <li key={`${r.position.lat},${r.position.lng}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect(r.position)
                  setResults(null)
                  setQuery(r.label.split(',').slice(0, 2).join(','))
                }}
                className="w-full px-3 py-2 text-left"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
