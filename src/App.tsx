import { useEffect, useReducer, useState } from 'react'
import { Card, PrimaryButton } from './components/Card'
import { HuntMap } from './components/HuntMap'
import { NavigationPanel } from './components/NavigationPanel'
import { RiddleCard } from './components/RiddleCard'
import { TestPanel } from './components/TestPanel'
import { demoHunt } from './game/demoHunt'
import { loadProgress, reduceProgress, saveProgress, type Action, type Progress } from './game/progress'
import { useGeolocation } from './hooks/useGeolocation'
import { useTestMode } from './hooks/useTestMode'
import { useWakeLock } from './hooks/useWakeLock'
import { distanceMeters } from './lib/geo'

const hunt = demoHunt

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

export default function App() {
  const [progress, dispatch] = useReducer(
    (state: Progress, action: Action) => reduceProgress(hunt, state, action),
    hunt,
    loadProgress,
  )
  const testMode = useTestMode()
  const [radius, setRadius] = useState(hunt.radius)
  const [recenterKey, setRecenterKey] = useState(0)

  const { phase, index } = progress
  const playing = phase !== 'intro'
  const geo = useGeolocation(playing)
  useWakeLock(playing && phase !== 'finished')
  const station = hunt.stations[index]
  const target = phase === 'travel' ? station : null
  const done = playing ? hunt.stations.slice(0, phase === 'travel' ? index : index + 1) : []
  const distance = target && geo.position ? distanceMeters(geo.position, target.position) : null

  useEffect(() => {
    saveProgress(hunt, progress)
  }, [progress])

  // Geofence: Ankunft automatisch erkennen
  useEffect(() => {
    if (distance != null && distance <= radius) {
      dispatch({ type: 'arrive' })
      navigator.vibrate?.(300)
    }
  }, [distance, radius])

  // Beim Phasenwechsel nach oben scrollen, damit Kapitel und Rätsel sichtbar sind.
  // Blockkörper ist Pflicht: Neuere Chrome-Versionen geben bei scrollTo() ein Promise zurück,
  // das React sonst als Aufräumfunktion aufrufen würde („… is not a function“).
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [phase, index])

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <header className="safe-top sticky top-0 z-[1000] bg-brand-700 text-white shadow">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="select-none text-lg font-bold" onClick={testMode.registerTap}>
            🗝️ {hunt.title}
          </h1>
        </div>
        {playing && (
          <div className="flex gap-1 px-4 pb-2" aria-label="Fortschritt">
            {hunt.stations.map((s, i) => (
              <div
                key={s.id}
                className={`h-1.5 flex-1 rounded-full ${
                  i < index || phase === 'finished' || (i === index && phase !== 'travel') ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        )}
      </header>

      {playing && phase !== 'finished' && (
        <div className="h-[42vh] min-h-56 shrink-0">
          <HuntMap
            target={target}
            done={done}
            player={geo.position}
            accuracy={geo.accuracy}
            radius={radius}
            recenterKey={recenterKey}
          />
        </div>
      )}

      <main className="safe-bottom flex flex-1 flex-col gap-3 p-3">
        {phase === 'intro' && (
          <Card title="Die Geschichte">
            <p className="leading-relaxed">{hunt.intro}</p>
            <p className="mt-3 text-sm text-stone-500">
              Die App braucht deinen Standort, um zu erkennen, wann ihr eine Station erreicht. Am besten mit dem Handy
              draußen spielen.
            </p>
            <div className="mt-4">
              <PrimaryButton onClick={() => dispatch({ type: 'start', now: Date.now() })}>Jagd starten</PrimaryButton>
            </div>
          </Card>
        )}

        {phase === 'travel' && (
          <NavigationPanel
            target={station}
            stationNumber={index + 1}
            stationCount={hunt.stations.length}
            geo={geo}
            radius={radius}
            onRecenter={() => setRecenterKey((k) => k + 1)}
          />
        )}

        {phase === 'chapter' && (
          <Card title={`${station.name} erreicht!`}>
            <p className="leading-relaxed">{station.chapter}</p>
            <div className="mt-4">
              <PrimaryButton onClick={() => dispatch({ type: 'openRiddle' })}>Zum Rätsel</PrimaryButton>
            </div>
          </Card>
        )}

        {phase === 'riddle' && (
          <RiddleCard
            key={station.id}
            riddle={station.riddle}
            hintsUsed={progress.hintsUsed[index]}
            onSolved={() => dispatch({ type: 'solve', now: Date.now() })}
            onWrong={() => dispatch({ type: 'wrongAnswer' })}
            onHint={() => dispatch({ type: 'revealHint' })}
          />
        )}

        {phase === 'finished' && (
          <Card title="🏆 Schatz gefunden!">
            <p className="leading-relaxed">{hunt.outro}</p>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-brand-50 p-2 dark:bg-stone-800">
                <dt className="text-xs text-stone-500">Dauer</dt>
                <dd className="font-semibold">
                  {progress.startedAt && progress.finishedAt
                    ? formatDuration(progress.finishedAt - progress.startedAt)
                    : '–'}
                </dd>
              </div>
              <div className="rounded-xl bg-brand-50 p-2 dark:bg-stone-800">
                <dt className="text-xs text-stone-500">Tipps</dt>
                <dd className="font-semibold">{progress.hintsUsed.reduce((a, b) => a + b, 0)}</dd>
              </div>
              <div className="rounded-xl bg-brand-50 p-2 dark:bg-stone-800">
                <dt className="text-xs text-stone-500">Fehlversuche</dt>
                <dd className="font-semibold">{progress.wrongAnswers}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <PrimaryButton onClick={() => dispatch({ type: 'reset' })}>Noch einmal spielen</PrimaryButton>
            </div>
          </Card>
        )}

        {testMode.enabled && (
          <TestPanel
            canMarkReached={phase === 'travel'}
            radius={radius}
            geo={geo}
            distance={distance}
            onMarkReached={() => dispatch({ type: 'arrive' })}
            onRadiusChange={setRadius}
            onReset={() => {
              if (confirm('Fortschritt wirklich zurücksetzen?')) dispatch({ type: 'reset' })
            }}
            onClose={() => testMode.setEnabled(false)}
          />
        )}

        <p className="mt-auto pt-4 text-center text-xs text-stone-400">Version {__APP_VERSION__}</p>
      </main>
    </div>
  )
}
