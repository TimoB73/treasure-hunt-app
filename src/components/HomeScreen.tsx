import { useEffect, useState } from 'react'
import { GeneratorError, loadMyHunts, type GeneratedHunt } from '../game/generator'
import { Card, PrimaryButton } from './Card'
import { ErrorNotice } from './ErrorNotice'

interface Props {
  onCreate: () => void
  onPlayDemo: () => void
  onOpenHunt: (id: string) => void
}

export function HomeScreen({ onCreate, onPlayDemo, onOpenHunt }: Props) {
  const [hunts, setHunts] = useState<GeneratedHunt[] | null>(null)
  const [error, setError] = useState<GeneratorError | null>(null)

  useEffect(() => {
    let active = true
    loadMyHunts()
      .then((h) => active && setHunts(h))
      .catch((e: GeneratorError) => active && setError(e))
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <Card title="Neue Schatzsuche">
        <p className="leading-relaxed">
          Startpunkt und ein paar Eckdaten wählen – die App sucht echte Orte in der Nähe, plant die Route und schreibt
          Geschichte und Rätsel dazu.
        </p>
        <div className="mt-4">
          <PrimaryButton onClick={onCreate}>✨ Jagd erzeugen</PrimaryButton>
        </div>
      </Card>

      <Card title="Meine Jagden">
        {error ? (
          <ErrorNotice title={error.message} action={error.action} />
        ) : hunts == null ? (
          <p className="text-stone-500">Wird geladen …</p>
        ) : hunts.length === 0 ? (
          <p className="text-stone-500">Auf diesem Gerät wurde noch keine Jagd erzeugt.</p>
        ) : (
          <ul className="divide-y divide-stone-200 dark:divide-stone-800">
            {hunts.map((h) => (
              <li key={h.id}>
                <button onClick={() => onOpenHunt(h.id)} className="w-full py-2 text-left">
                  <span className="font-medium">{h.title}</span>
                  <span className="block text-xs text-stone-500">
                    {new Date(h.createdAt).toLocaleDateString('de-DE')} · {h.stations.length} Stationen ·{' '}
                    {h.params.mode === 'bike' ? 'Fahrrad' : 'zu Fuß'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <button onClick={onPlayDemo} className="text-sm text-stone-500 underline">
        Demo-Jagd mit 3 festen Stationen spielen
      </button>
    </>
  )
}
