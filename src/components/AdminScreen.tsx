import { useEffect, useState, type FormEvent } from 'react'
import { GeneratorError } from '../game/generator'
import { manageAllowlist, type AllowlistEntry } from '../lib/account'
import { Card, PrimaryButton } from './Card'
import { ErrorNotice } from './ErrorNotice'

/** Gästeliste pflegen – die Cloud Function prüft, ob die anfragende Person Admin ist */
export function AdminScreen({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<AllowlistEntry[] | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<GeneratorError | null>(null)

  const run = async (request: Parameters<typeof manageAllowlist>[0]) => {
    setBusy(true)
    setError(null)
    try {
      setEntries(await manageAllowlist(request))
      return true
    } catch (e) {
      setError(e instanceof GeneratorError ? e : new GeneratorError(String(e)))
      return false
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    run({ action: 'list' })
  }, [])

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (await run({ action: 'add', email })) setEmail('')
  }

  return (
    <>
      <Card title="🛡️ Gästeliste">
        <p className="text-sm text-stone-500">
          Nur Personen mit diesen E-Mail-Adressen dürfen Jagden erstellen (nach bestätigter E-Mail). Mitspielen geht
          für alle mit Link.
        </p>
        <form onSubmit={add} className="mt-3 flex gap-2">
          <input
            type="email"
            required
            placeholder="name@beispiel.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-transparent px-3 py-2 dark:border-stone-700"
          />
          <div className="shrink-0">
            <PrimaryButton type="submit" disabled={busy || !email.trim()}>
              Hinzufügen
            </PrimaryButton>
          </div>
        </form>
        {error && (
          <div className="mt-3">
            <ErrorNotice title={error.message} action={error.action} />
          </div>
        )}
      </Card>

      <Card title={entries ? `Freigeschaltet (${entries.length})` : 'Freigeschaltet'}>
        {entries == null ? (
          <p className="text-stone-500">{busy ? 'Wird geladen …' : '–'}</p>
        ) : entries.length === 0 ? (
          <p className="text-stone-500">Noch niemand. Admins brauchen keinen Eintrag.</p>
        ) : (
          <ul className="divide-y divide-stone-200 dark:divide-stone-800">
            {entries.map((entry) => (
              <li key={entry.email} className="flex items-center justify-between gap-2 py-2">
                <span className="break-all">{entry.email}</span>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`${entry.email} wirklich entfernen?`)) run({ action: 'remove', email: entry.email })
                  }}
                  className="shrink-0 text-sm text-red-600 underline disabled:opacity-40"
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <button onClick={onBack} className="text-sm text-stone-500 underline">
        Zurück zum Konto
      </button>
    </>
  )
}
