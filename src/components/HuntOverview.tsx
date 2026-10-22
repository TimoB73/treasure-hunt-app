import { useState } from 'react'
import type { GeneratedHunt } from '../game/generator'
import { genreLabel } from '../game/genres'
import type { AnswerSpec } from '../lib/answer'
import { formatDistance } from '../lib/geo'
import { Card, PrimaryButton } from './Card'
import { OverviewMap } from './OverviewMap'

interface Props {
  hunt: GeneratedHunt
  onPlay: () => void
  onBack: () => void
}

function solutionText(answer: AnswerSpec): string {
  switch (answer.type) {
    case 'number':
      return String(answer.solution).replace('.', ',')
    case 'choice':
      return answer.options[answer.solution]
    case 'text':
      return answer.solutions.join(' / ')
  }
}

export function playLink(huntId: string): string {
  return `${window.location.origin}/?jagd=${encodeURIComponent(huntId)}`
}

/** Übersicht für den Spielleiter: Route, Eckdaten, Link zum Teilen und (verdeckt) alle Lösungen */
export function HuntOverview({ hunt, onPlay, onBack }: Props) {
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'failed'>('idle')
  // Route verdeckt, damit ein mitspielender Spielleiter nicht alle Stationen vorab sieht
  const [showRoute, setShowRoute] = useState(false)
  const { params, stats } = hunt

  const share = async () => {
    const url = playLink(hunt.id)
    try {
      if (navigator.share) {
        await navigator.share({ title: hunt.title, text: `Spielt mit: ${hunt.title}`, url })
      } else {
        await navigator.clipboard.writeText(url)
        setShareState('copied')
      }
    } catch (e) {
      // Abbruch des Teilen-Dialogs ist kein Fehler
      if ((e as Error).name !== 'AbortError') setShareState('failed')
    }
  }

  return (
    <>
      <Card title={hunt.title}>
        <p className="leading-relaxed">{hunt.intro}</p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-brand-50 p-2 dark:bg-stone-800">
            <dt className="text-xs text-stone-500">Weg</dt>
            <dd className="font-semibold">{formatDistance(stats.routeMeters)}</dd>
          </div>
          <div className="rounded-xl bg-brand-50 p-2 dark:bg-stone-800">
            <dt className="text-xs text-stone-500">Dauer ca.</dt>
            <dd className="font-semibold">{stats.estimatedMinutes} min</dd>
          </div>
          <div className="rounded-xl bg-brand-50 p-2 dark:bg-stone-800">
            <dt className="text-xs text-stone-500">Stationen</dt>
            <dd className="font-semibold">{hunt.stations.length}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-stone-500">
          {genreLabel(params.genre)} · {params.mode === 'bike' ? 'Fahrrad' : 'Zu Fuß'} · {params.difficulty} · ab{' '}
          {params.age} Jahren
          {params.groupCount > 1 && ` · ${params.groupCount} Gruppen, ${params.staggerMinutes} min versetzt`}
          {params.goal && ' · Ziel selbst gewählt'}
        </p>
      </Card>

      <Card title="Route">
        {showRoute ? (
          <>
            <div className="h-72 overflow-hidden rounded-xl">
              <OverviewMap start={params.start} stations={hunt.stations.map((s) => s.position)} fitKey={hunt.id} />
            </div>
            <ol className="mt-3 space-y-1 text-sm">
              {hunt.stations.map((s, i) => (
                <li key={s.id}>
                  {i === hunt.stations.length - 1 ? '🏁' : `${i + 1}.`} {s.name}{' '}
                  {s.name !== s.kindLabel && <span className="text-stone-500">({s.kindLabel})</span>}
                </li>
              ))}
            </ol>
            <button onClick={() => setShowRoute(false)} className="mt-2 text-sm text-stone-500 underline">
              Route wieder verbergen
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-stone-500">
              Beim Spielen zeigt die Karte immer nur die nächste Station – erst nach gelöstem Rätsel erscheint die
              folgende.
            </p>
            <button onClick={() => setShowRoute(true)} className="mt-2 text-sm font-medium underline">
              🔒 Alle Stationen auf der Karte zeigen (Spoiler)
            </button>
          </>
        )}
        {params.groupCount > 1 && (
          <p className="mt-2 text-xs text-stone-500">
            Mehrere Gruppen laufen die Stationen später in versetzter Reihenfolge und treffen sich am Ziel 🏁 (Phase 4).
          </p>
        )}
      </Card>

      <Card>
        <details>
          <summary className="cursor-pointer font-medium">🔒 Rätsel und Lösungen anzeigen (Spoiler)</summary>
          <ol className="mt-3 space-y-3 text-sm">
            {hunt.stations.map((s, i) => (
              <li key={s.id}>
                <p className="font-medium">
                  {i + 1}. {s.name}
                </p>
                <p>{s.riddle.question}</p>
                <p className="text-green-700 dark:text-green-400">Lösung: {solutionText(s.riddle.answer)}</p>
              </li>
            ))}
          </ol>
        </details>
      </Card>

      <PrimaryButton onClick={onPlay}>Jetzt spielen</PrimaryButton>
      <button
        onClick={share}
        className="w-full rounded-xl border border-brand-600 px-4 py-3 font-semibold text-brand-700 dark:text-brand-500"
      >
        🔗 Link für Mitspieler teilen
      </button>
      {shareState === 'copied' && <p className="text-center text-sm text-stone-500">Link kopiert.</p>}
      {shareState === 'failed' && (
        <p className="break-all text-center text-sm text-stone-500">Link zum Kopieren: {playLink(hunt.id)}</p>
      )}
      <button onClick={onBack} className="text-sm text-stone-500 underline">
        Zur Übersicht
      </button>
    </>
  )
}
