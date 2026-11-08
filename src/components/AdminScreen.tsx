import { useEffect, useState, type FormEvent } from 'react'
import { GeneratorError } from '../game/generator'
import { manageAllowlist, type AllowlistEntry } from '../lib/account'
import { INVITE_SUBJECT, inviteMailto, inviteText } from '../lib/invite'
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

  const appUrl = window.location.origin

  /** Öffnet das eigene Mailprogramm mit fertiger Einladung (wie bei der Hertha-App) */
  const mailInvite = (address: string) => {
    window.location.href = inviteMailto(address, appUrl)
  }

  /** Einladung über das Teilen-Menü (z. B. WhatsApp); ohne Teilen-Menü wird der Text kopiert */
  const shareInvite = async (address: string) => {
    const text = inviteText(address, appUrl)
    try {
      if (navigator.share) await navigator.share({ title: INVITE_SUBJECT, text })
      else {
        await navigator.clipboard.writeText(text)
        alert('Einladungstext kopiert – jetzt z. B. in WhatsApp einfügen.')
      }
    } catch {
      // Teilen abgebrochen – kein Fehler
    }
  }

  const add = async (e: FormEvent, invite: boolean) => {
    e.preventDefault()
    const address = email.trim()
    if (!address) return
    if (await run({ action: 'add', email: address })) {
      setEmail('')
      if (invite) mailInvite(address)
    }
  }

  return (
    <>
      <Card title="🛡️ Gästeliste">
        <p className="text-sm text-stone-500">
          Nur Personen mit diesen E-Mail-Adressen dürfen Jagden erstellen (nach bestätigter E-Mail). Mitspielen geht
          für alle mit Link.
        </p>
        <form onSubmit={(e) => add(e, true)} className="mt-3 grid gap-2">
          <input
            type="email"
            required
            placeholder="name@beispiel.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-stone-300 bg-transparent px-3 py-2 dark:border-stone-700"
          />
          <PrimaryButton type="submit" disabled={busy || !email.trim()}>
            ✉️ Freischalten & per Mail einladen
          </PrimaryButton>
          <button
            type="button"
            disabled={busy || !email.trim()}
            onClick={(e) => add(e, false)}
            className="text-sm text-stone-500 underline disabled:opacity-40"
          >
            Nur freischalten, ohne Mail
          </button>
        </form>
        <p className="mt-2 text-xs text-stone-500">
          „Per Mail einladen“ öffnet dein Mailprogramm mit fertiger Einladung (Link, Anleitung für iPhone und Android,
          Anmeldung) – du musst nur noch auf Senden tippen.
        </p>
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
                <span className="min-w-0 flex-1 break-all">{entry.email}</span>
                <button onClick={() => mailInvite(entry.email)} className="shrink-0 text-sm underline" aria-label="Per Mail einladen">
                  ✉️
                </button>
                <button onClick={() => shareInvite(entry.email)} className="shrink-0 text-sm underline" aria-label="Einladung teilen">
                  📤
                </button>
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
