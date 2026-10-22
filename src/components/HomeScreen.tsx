import { useEffect, useState } from 'react'
import { GeneratorError, loadMyHunts, type GeneratedHunt } from '../game/generator'
import { canCreate, type AccountState } from '../lib/account'
import { Card, PrimaryButton } from './Card'
import { ErrorNotice } from './ErrorNotice'

interface Props {
  account: AccountState
  onCreate: () => void
  onAccount: () => void
  onPlayDemo: () => void
  onOpenHunt: (id: string) => void
}

function MyHunts({ uid, onOpenHunt }: { uid: string; onOpenHunt: (id: string) => void }) {
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
  }, [uid])

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
