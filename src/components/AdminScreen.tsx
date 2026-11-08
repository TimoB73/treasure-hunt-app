import { useEffect, useState, type FormEvent } from 'react'
import { GeneratorError } from '../game/generator'
import { manageAllowlist, type AllowlistEntry } from '../lib/account'
import { INVITE_SUBJECT, inviteMailto, inviteText } from '../lib/invite'
import { Card, PrimaryButton } from './Card'
import { ErrorNotice } from './ErrorNotice'

const SENDER_KEY = 'schatzsuche.inviteSender'

function loadSender(): string {
  try {
    return localStorage.getItem(SENDER_KEY) ?? ''
  } catch {
    return ''
  }
}

const secondaryButton =
  'rounded-xl border border-stone-300 px-3 py-2 text-center text-sm font-medium dark:border-stone-700'

/**
 * Gästeliste pflegen und neue Spielleiter einladen – die Cloud Function prüft, ob die anfragende Person Admin ist.
 * Einladen wie bei der Hertha-App: Das eigene Mailprogramm öffnet sich mit fertiger Mail, alternativ Teilen (WhatsApp & Co.).
 */
export function AdminScreen({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<AllowlistEntry[] | null>(null)
  const [email, setEmail] = useState('')
  const [sender, setSender] = useState(loadSender)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<GeneratorError | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [lastAdded, setLastAdded] = useState<string | null>(null)

  const run = async (request: Parameters<typeof manageAllowlist>[0]) => {
    setBusy(true)
    setError(null)
    setMessage(null)
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
  const senderName = sender.trim() || null

  const saveSender = (value: string) => {
    setSender(value)
    try {
      localStorage.setItem(SENDER_KEY, value)
    } catch {
      // ohne Speicher gilt der Name nur bis zum Neuladen
    }
  }

  const mailLink = (address: string) => inviteMailto(address, appUrl, senderName)

  /** Einladung über das Teilen-Menü (z. B. WhatsApp); ohne Teilen-Menü wird der Text kopiert */
  const shareInvite = async (address: string) => {
    const text = inviteText(address, appUrl, senderName)
    try {
      if (navigator.share) {
        await navigator.share({ title: INVITE_SUBJECT, text })
      } else {
        await navigator.clipboard.writeText(text)
        setMessage('Einladung kopiert ✓ – jetzt z. B. in WhatsApp einfügen.')
      }
    } catch {
      // Teilen abgebrochen – kein Fehler
    }
  }

  const add = async (e: FormEvent, invite: boolean) => {
    e.preventDefault()
    const address = email.trim().toLowerCase()
    if (!address) return
    if (await run({ action: 'add', email: address })) {
      setEmail('')
      setLastAdded(address)
      // Öffnet das eigene Mailprogramm mit fertiger Einladung – nur noch „Senden“ tippen
      if (invite) window.location.href = mailLink(address)
      setMessage(
        invite
          ? `${address} ist freigeschaltet – die Einladung ist im Mailprogramm vorbereitet.`
          : `${address} ist freigeschaltet.`,
      )
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
            placeholder="E-Mail-Adresse"
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
            className={`${secondaryButton} disabled:opacity-40`}
          >
            Nur freischalten
          </button>
        </form>

        {message && <p className="mt-3 text-sm text-green-700 dark:text-green-400">{message}</p>}
        {lastAdded && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a href={mailLink(lastAdded)} className={secondaryButton}>
              ✉️ Mail an {lastAdded.split('@')[0]}
            </a>
            <button onClick={() => shareInvite(lastAdded)} className={secondaryButton}>
              📨 WhatsApp & Co.
            </button>
          </div>
        )}
        {error && (
          <div className="mt-3">
            <ErrorNotice title={error.message} action={error.action} />
          </div>
        )}

        <label className="mt-4 grid gap-1">
          <span className="text-sm font-medium">Dein Name in der Einladung (optional)</span>
          <input
            value={sender}
            onChange={(e) => saveSender(e.target.value)}
            placeholder="z. B. Timo"
            className="rounded-xl border border-stone-300 bg-transparent px-3 py-2 dark:border-stone-700"
          />
          <span className="text-xs text-stone-500">
            Steht dann in der Mail: „{senderName ?? 'Timo'} hat dich zur Schatzsuche-App eingeladen“. Die Mail enthält
            den Link und die Anleitung für iPhone und Android (installieren, registrieren, E-Mail bestätigen).
          </span>
        </label>
      </Card>

      <Card title={entries ? `Freigeschaltet (${entries.length})` : 'Freigeschaltet'}>
        {entries == null ? (
          <p className="text-stone-500">{busy ? 'Wird geladen …' : '–'}</p>
        ) : entries.length === 0 ? (
          <p className="text-stone-500">Noch niemand. Admins brauchen keinen Eintrag.</p>
        ) : (
          <ul className="divide-y divide-stone-200 dark:divide-stone-800">
            {entries.map((entry) => (
              <li key={entry.email} className="py-3">
                <p className="break-all font-medium">{entry.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={mailLink(entry.email)} className={secondaryButton}>
                    ✉️ Mail
                  </a>
                  <button onClick={() => shareInvite(entry.email)} className={secondaryButton}>
                    📨 WhatsApp & Co.
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`${entry.email} wirklich entfernen?`)) run({ action: 'remove', email: entry.email })
                    }}
                    className="ml-auto text-sm text-red-600 underline disabled:opacity-40"
                  >
                    Entfernen
                  </button>
                </div>
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
