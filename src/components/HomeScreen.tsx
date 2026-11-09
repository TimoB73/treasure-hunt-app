import { useEffect, useState } from 'react'
import { GeneratorError, loadMyHunts, type GeneratedHunt } from '../game/generator'
import { canCreate, type AccountState } from '../lib/account'
import { formatDistance } from '../lib/geo'
import { cachedPlaceName, reversePlaceName, type PlaceName } from '../lib/geocode'
import { Card, PrimaryButton } from './Card'
import { ErrorNotice } from './ErrorNotice'

interface Props {
  account: AccountState
  onCreate: () => void
  onAccount: () => void
  onPlayDemo: () => void
  onOpenHunt: (id: string) => void
}

/** „Steglitz, Berlin · Deutschland“ – fehlende Teile werden weggelassen */
function placeLabel(place: PlaceName | undefined): string {
  if (!place) return 'Ort wird ermittelt …'
  const local = [place.district, place.city].filter(Boolean).join(', ')
  return [local, place.country].filter(Boolean).join(' · ') || 'Ort unbekannt'
}

function MyHunts({ uid, onOpenHunt }: { uid: string; onOpenHunt: (id: string) => void }) {
  const [hunts, setHunts] = useState<GeneratedHunt[] | null>(null)
  const [error, setError] = useState<GeneratorError | null>(null)

  const [places, setPlaces] = useState<Record<string, PlaceName>>({})

  useEffect(() => {
    let active = true
    loadMyHunts()
      .then((h) => active && setHunts(h))
      .catch((e: GeneratorError) => active && setError(e))
    return () => {
      active = false
    }
  }, [uid])

  // Ortsnamen zum Startpunkt: zuerst aus dem Gerätespeicher, fehlende nacheinander nachladen
  // (der Suchdienst von OpenStreetMap erlaubt höchstens eine Anfrage pro Sekunde)
  useEffect(() => {
    if (!hunts) return
    let active = true
    const known: Record<string, PlaceName> = {}
    const missing: GeneratedHunt[] = []
    for (const h of hunts) {
      const cached = cachedPlaceName(h.params.start)
      if (cached) known[h.id] = cached
      else missing.push(h)
    }
    setPlaces(known)
    ;(async () => {
      for (const h of missing) {
        try {
          const name = await reversePlaceName(h.params.start)
          if (!active) return
          setPlaces((p) => ({ ...p, [h.id]: name }))
        } catch {
          // Ortsname ist nur Zusatzinfo – bei Fehlern einfach weglassen
        }
        await new Promise((r) => setTimeout(r, 1100))
        if (!active) return
      }
    })()
    return () => {
      active = false
    }
  }, [hunts])

  return (
    <Card title="Meine Jagden">
      {error ? (
        <ErrorNotice title={error.message} action={error.action} />
      ) : hunts == null ? (
        <p className="text-stone-500">Wird geladen …</p>
      ) : hunts.length === 0 ? (
        <p className="text-stone-500">Noch keine Jagd erstellt.</p>
      ) : (
        <ul className="divide-y divide-stone-200 dark:divide-stone-800">
          {hunts.map((h) => (
            <li key={h.id}>
              <button onClick={() => onOpenHunt(h.id)} className="w-full py-2 text-left">
                <span className="font-medium">{h.title}</span>
                <span className="block text-xs text-stone-500">📍 {placeLabel(places[h.id])}</span>
                <span className="block text-xs text-stone-500">
                  📏 {formatDistance(h.stats.routeMeters)} · ⏱ ca. {h.stats.estimatedMinutes} min ·{' '}
                  {h.stations.length} Stationen · {h.params.mode === 'bike' ? 'Fahrrad' : 'zu Fuß'} ·{' '}
                  {new Date(h.createdAt).toLocaleDateString('de-DE')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function HomeScreen({ account, onCreate, onAccount, onPlayDemo, onOpenHunt }: Props) {
  const allowed = canCreate(account)

  return (
    <>
      <Card title="Neue Schatzsuche">
        <p className="leading-relaxed">
          Startpunkt und ein paar Eckdaten wählen – die App sucht echte Orte in der Nähe, plant die Route und schreibt
          Geschichte und Rätsel dazu.
        </p>
        <div className="mt-4">
          {account.status === 'loading' ? (
            <p className="text-stone-500">Wird geladen …</p>
          ) : allowed ? (
            <PrimaryButton onClick={onCreate}>✨ Jagd erzeugen</PrimaryButton>
          ) : account.status === 'signedOut' ? (
            <PrimaryButton onClick={onAccount}>Anmelden, um Jagden zu erstellen</PrimaryButton>
          ) : account.status === 'unverified' ? (
            <PrimaryButton onClick={onAccount}>E-Mail-Adresse bestätigen</PrimaryButton>
          ) : (
            <ErrorNotice
              title="Diese App ist privat – bitte beim Betreiber freischalten lassen."
              action="Dem Betreiber die E-Mail-Adresse deines Kontos nennen (siehe 👤 oben rechts)."
            />
          )}
        </div>
      </Card>

      {account.status === 'ready' && <MyHunts uid={account.info.uid} onOpenHunt={onOpenHunt} />}

      <Card title="Mitspielen">
        <p className="text-sm leading-relaxed text-stone-500">
          Zum Mitspielen brauchst du kein Konto – öffne einfach den Link, den du von der Spielleitung bekommen hast.
        </p>
      </Card>

      <button onClick={onPlayDemo} className="text-sm text-stone-500 underline">
        Demo-Jagd mit 3 festen Stationen spielen
      </button>
    </>
  )
}
