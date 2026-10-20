import { useEffect, useState, type ReactNode } from 'react'
import { GeneratorError, generateHunt, type HuntParams } from '../game/generator'
import { GENRES } from '../game/genres'
import { useWakeLock } from '../hooks/useWakeLock'
import type { LatLng } from '../lib/geo'
import { Card, PrimaryButton } from './Card'
import { ErrorNotice } from './ErrorNotice'
import { OverviewMap } from './OverviewMap'

interface Props {
  onCreated: (huntId: string) => void
  onCancel: () => void
}

type Settings = Omit<HuntParams, 'start'>

const DEFAULTS: Settings = {
  durationMinutes: 60,
  difficulty: 'mittel',
  age: 10,
  mode: 'foot',
  stationCount: 5,
  groupCount: 1,
  staggerMinutes: 5,
  genre: 'beliebig',
}

/** Grobe Fortschrittsanzeige – die Cloud Function meldet keine Zwischenstände */
const STEPS = [
  { after: 0, text: 'Suche geeignete Orte in der Umgebung …' },
  { after: 8, text: 'Berechne Wege zwischen den Orten …' },
  { after: 16, text: 'Claude schreibt Geschichte und Rätsel … (dauert 1–3 Minuten)' },
  { after: 120, text: 'Gleich fertig – die letzten Rätsel werden geprüft …' },
]

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-stone-500">{hint}</span>}
    </label>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-2 py-2 text-sm font-medium ${
            value === o.value ? 'bg-white shadow dark:bg-stone-950' : 'text-stone-500'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const inputClass = 'rounded-xl border border-stone-300 bg-transparent px-3 py-2 dark:border-stone-700'

/** Zahlenfeld, das erst beim Verlassen auf min/max begrenzt – sonst ließe sich z. B. „12“ nicht tippen, wenn min 4 ist */
function NumberInput({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value !== '' && Number.isInteger(n) && n >= min && n <= max) onChange(n)
      }}
      onBlur={() => {
        const n = Math.min(max, Math.max(min, Math.round(Number(text) || min)))
        setText(String(n))
        onChange(n)
      }}
      className={inputClass}
    />
  )
}

export function GeneratorScreen({ onCreated, onCancel }: Props) {
  const [start, setStart] = useState<LatLng | null>(null)
  const [fitKey, setFitKey] = useState(0)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<GeneratorError | null>(null)
  useWakeLock(running)

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }))

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setLocateError('Dieses Gerät kann den Standort nicht bestimmen – bitte auf der Karte tippen.')
      return
    }
    setLocating(true)
    setLocateError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStart({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setFitKey((k) => k + 1)
        setLocating(false)
      },
      () => {
        setLocateError('Standort nicht verfügbar – bitte den Startpunkt auf der Karte antippen.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  }

  // Beim Öffnen gleich den eigenen Standort als Start vorschlagen
  useEffect(locate, [])

  useEffect(() => {
    if (!running) return
    const startedAt = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [running])

  const submit = async () => {
    if (!start) return
    setRunning(true)
    setElapsed(0)
    setError(null)
    try {
      onCreated(await generateHunt({ ...settings, start }))
    } catch (e) {
      setError(e instanceof GeneratorError ? e : new GeneratorError(String(e)))
    } finally {
      setRunning(false)
    }
  }

  if (running) {
    const step = [...STEPS].reverse().find((s) => elapsed >= s.after)!
    return (
      <Card title="Jagd wird erzeugt">
        <div className="flex items-center gap-3">
          <span className="inline-block h-6 w-6 shrink-0 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          <p>{step.text}</p>
        </div>
        <p className="mt-3 text-sm text-stone-500">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} min · Bitte die App geöffnet lassen. Falls die
          Verbindung abbricht: Die fertige Jagd erscheint trotzdem unter „Meine Jagden“.
        </p>
      </Card>
    )
  }

  const maxGroups = Math.max(1, settings.stationCount - 1)

  return (
    <>
      {error && <ErrorNotice title={error.message} action={error.action} />}

      <Card title="Startpunkt">
        <div className="h-64 overflow-hidden rounded-xl">
          <OverviewMap start={start} onPick={setStart} fitKey={fitKey} />
        </div>
        <p className="mt-2 text-sm text-stone-500">
          {start
            ? 'Startpunkt gesetzt. Zum Ändern auf die Karte tippen.'
            : 'Auf die Karte tippen, um den Startpunkt zu setzen.'}
        </p>
        {locateError && <p className="mt-1 text-sm text-red-600">{locateError}</p>}
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="mt-2 rounded-lg border border-stone-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-stone-700"
        >
          {locating ? 'Standort wird ermittelt …' : '📍 Meinen Standort verwenden'}
        </button>
      </Card>

      <Card title="Eckdaten">
        <div className="grid gap-4">
          <Field label="Fortbewegung">
            <Segmented
              value={settings.mode}
              onChange={(v) => set('mode', v)}
              options={[
                { value: 'foot', label: '🚶 Zu Fuß' },
                { value: 'bike', label: '🚲 Fahrrad' },
              ]}
            />
          </Field>
          <div className="grid gap-1">
            <span className="text-sm font-medium">Genre</span>
            <div className="grid grid-cols-3 gap-1">
              {GENRES.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => set('genre', g.value)}
                  aria-pressed={settings.genre === g.value}
                  className={`rounded-xl border px-1 py-2 text-xs font-medium ${
                    settings.genre === g.value
                      ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-stone-800 dark:text-brand-500'
                      : 'border-stone-300 text-stone-600 dark:border-stone-700 dark:text-stone-300'
                  }`}
                >
                  <span className="block text-lg">{g.emoji}</span>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Schwierigkeit">
            <Segmented
              value={settings.difficulty}
              onChange={(v) => set('difficulty', v)}
              options={[
                { value: 'leicht', label: 'Leicht' },
                { value: 'mittel', label: 'Mittel' },
                { value: 'schwer', label: 'Schwer' },
              ]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dauer (Minuten)">
              <select
                value={settings.durationMinutes}
                onChange={(e) => set('durationMinutes', Number(e.target.value))}
                className={inputClass}
              >
                {[30, 45, 60, 90, 120, 150, 180].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Alter (jüngste Person)">
              <NumberInput value={settings.age} min={4} max={99} onChange={(n) => set('age', n)} />
            </Field>
            <Field label="Stationen" hint="inkl. gemeinsamem Ziel">
              <NumberInput
                value={settings.stationCount}
                min={3}
                max={12}
                onChange={(n) => setSettings((s) => ({ ...s, stationCount: n, groupCount: Math.min(s.groupCount, n - 1) }))}
              />
            </Field>
            <Field label="Gruppen" hint={`höchstens ${maxGroups}`}>
              <NumberInput value={settings.groupCount} min={1} max={maxGroups} onChange={(n) => set('groupCount', n)} />
            </Field>
            {settings.groupCount > 1 && (
              <Field label="Startversatz (Minuten)" hint="zwischen zwei Gruppen">
                <NumberInput value={settings.staggerMinutes} min={0} max={60} onChange={(n) => set('staggerMinutes', n)} />
              </Field>
            )}
          </div>
        </div>
      </Card>

      <PrimaryButton onClick={submit} disabled={!start}>
        ✨ Jagd erzeugen
      </PrimaryButton>
      <button onClick={onCancel} className="text-sm text-stone-500 underline">
        Abbrechen
      </button>
    </>
  )
}
