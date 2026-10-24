import { useState, type FormEvent } from 'react'
import { GeneratorError } from '../game/generator'
import {
  refreshAccount,
  resendVerification,
  resetPassword,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  type AccountState,
} from '../lib/account'
import { Card, PrimaryButton } from './Card'
import { ErrorNotice } from './ErrorNotice'

interface Props {
  account: AccountState
  onReload: () => void
  onOpenAdmin: () => void
  onHome: () => void
}

const inputClass = 'rounded-xl border border-stone-300 bg-transparent px-3 py-2 dark:border-stone-700'

/** Kleiner Helfer: Aktion ausführen, Fehler und Ladezustand anzeigen */
function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<GeneratorError | null>(null)
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof GeneratorError ? e : new GeneratorError(String(e)))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

function LoginForm() {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const { busy, error, run } = useAction()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setNotice(null)
    run(async () => {
      if (mode === 'login') await signIn(email, password)
      if (mode === 'register') {
        if (password.length < 8) throw new GeneratorError('Das Passwort ist zu kurz.', 'Mindestens 8 Zeichen verwenden.')
        if (password !== passwordRepeat) {
          throw new GeneratorError('Die beiden Passwörter stimmen nicht überein.', 'Bitte beide Felder gleich ausfüllen.')
        }
        await signUp(email, password)
      }
      if (mode === 'reset') {
        await resetPassword(email)
        setNotice('Falls es ein Konto mit dieser E-Mail gibt, ist ein Link zum Zurücksetzen unterwegs. Bitte auch im Spam-Ordner nachsehen.')
      }
    })
  }

  const tab = (value: typeof mode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(value)
        setNotice(null)
      }}
      className={`rounded-lg px-2 py-2 text-sm font-medium ${mode === value ? 'bg-white shadow dark:bg-stone-950' : 'text-stone-500'}`}
    >
      {label}
    </button>
  )

  return (
    <Card title={mode === 'reset' ? 'Passwort zurücksetzen' : 'Anmelden'}>
      <p className="text-sm text-stone-500">
        Ein Konto brauchst du nur zum <strong>Erstellen</strong> von Jagden. Zum Mitspielen reicht der Link, den du
        bekommen hast.
      </p>

      {mode !== 'reset' && (
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
          {tab('login', 'Anmelden')}
          {tab('register', 'Registrieren')}
        </div>
      )}

      <form onSubmit={submit} className="mt-3 grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-medium">E-Mail</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        {mode !== 'reset' && (
          <label className="grid gap-1">
            <span className="text-sm font-medium">Passwort</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                autoCapitalize="none"
                autoCorrect="off"
                required
                minLength={mode === 'register' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} w-full pr-24`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 px-3 text-sm text-stone-500"
              >
                {showPassword ? '🙈 Verbergen' : '👁️ Zeigen'}
              </button>
            </div>
            {mode === 'register' && <span className="text-xs text-stone-500">mindestens 8 Zeichen</span>}
          </label>
        )}
        {mode === 'register' && (
          <label className="grid gap-1">
            <span className="text-sm font-medium">Passwort wiederholen</span>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={passwordRepeat}
              onChange={(e) => setPasswordRepeat(e.target.value)}
              className={inputClass}
            />
            {passwordRepeat && passwordRepeat !== password && (
              <span className="text-xs text-red-600">Stimmt noch nicht mit dem Passwort überein.</span>
            )}
          </label>
        )}
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? 'Bitte warten …' : mode === 'login' ? 'Anmelden' : mode === 'register' ? 'Konto anlegen' : 'Link senden'}
        </PrimaryButton>
      </form>

      {error && (
        <div className="mt-3">
          <ErrorNotice title={error.message} action={error.action} />
        </div>
      )}
      {notice && <p className="mt-3 rounded-lg bg-green-50 p-2 text-sm text-green-900 dark:bg-green-950 dark:text-green-100">{notice}</p>}

      <div className="mt-3 flex flex-col items-start gap-2 text-sm">
        {mode === 'login' && (
          <button type="button" onClick={() => setMode('reset')} className="text-stone-500 underline">
            Passwort vergessen?
          </button>
        )}
        {mode === 'reset' && (
          <button type="button" onClick={() => setMode('login')} className="text-stone-500 underline">
            Zurück zur Anmeldung
          </button>
        )}
      </div>

      {mode !== 'reset' && (
        <>
          <div className="my-4 flex items-center gap-2 text-xs text-stone-400">
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" /> oder <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(signInWithGoogle)}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 font-semibold disabled:opacity-40 dark:border-stone-700"
          >
            Mit Google anmelden
          </button>
        </>
      )}
    </Card>
  )
}

function VerifyEmail({ email, onReload }: { email: string | null; onReload: () => void }) {
  const [notice, setNotice] = useState<string | null>(null)
  const { busy, error, run } = useAction()
  return (
    <Card title="E-Mail bestätigen">
      <p className="leading-relaxed">
        Wir haben einen Bestätigungslink an <strong>{email}</strong> geschickt. Bitte den Link antippen – auch im
        Spam-Ordner nachsehen – und danach hier auf „Ich habe bestätigt“ tippen.
      </p>
      <div className="mt-4 grid gap-2">
        <PrimaryButton
          disabled={busy}
          onClick={() =>
            run(async () => {
              await refreshAccount()
              onReload()
              setNotice('Noch nicht bestätigt? Dann bitte zuerst den Link in der E-Mail antippen.')
            })
          }
        >
          Ich habe bestätigt
        </PrimaryButton>
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              await resendVerification()
              setNotice('Neue Bestätigungs-E-Mail ist unterwegs.')
            })
          }
          className="text-sm text-stone-500 underline"
        >
          E-Mail erneut senden
        </button>
        <button onClick={() => signOut()} className="text-sm text-stone-500 underline">
          Abmelden
        </button>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorNotice title={error.message} action={error.action} />
        </div>
      )}
      {notice && <p className="mt-3 text-sm text-stone-500">{notice}</p>}
    </Card>
  )
}

export function AccountScreen({ account, onReload, onOpenAdmin, onHome }: Props) {
  const [copied, setCopied] = useState(false)

  switch (account.status) {
    case 'loading':
      return (
        <Card>
          <p className="text-stone-500">Wird geladen …</p>
        </Card>
      )
    case 'signedOut':
      return <LoginForm />
    case 'unverified':
      return <VerifyEmail email={account.user.email} onReload={onReload} />
    case 'error':
      return (
        <>
          <ErrorNotice title={account.error.message} action={account.error.action} />
          <button onClick={onReload} className="text-sm text-stone-500 underline">
            Erneut versuchen
          </button>
          <button onClick={() => signOut()} className="text-sm text-stone-500 underline">
            Abmelden
          </button>
        </>
      )
  }

  const { info } = account
  const copyUid = async () => {
    try {
      await navigator.clipboard.writeText(info.uid)
      setCopied(true)
    } catch {
      // Kopieren nicht erlaubt – die ID ist markierbar
    }
  }

  return (
    <>
      <Card title="Mein Konto">
        <p>
          Angemeldet als <strong>{info.email}</strong>
        </p>
        {info.isAllowed ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            ✓ Freigeschaltet –{' '}
            {info.monthlyLimit == null
              ? 'als Admin ohne Limit'
              : `${info.huntsThisMonth} von ${info.monthlyLimit} Jagden in diesem Monat erstellt`}
          </p>
        ) : (
          <div className="mt-3">
            <ErrorNotice
              title="Diese App ist privat – bitte beim Betreiber freischalten lassen."
              action={`Dem Betreiber deine E-Mail-Adresse ${info.email} nennen. Danach hier auf „Status aktualisieren“ tippen.`}
            />
            <button onClick={onReload} className="mt-2 text-sm text-stone-500 underline">
              Status aktualisieren
            </button>
          </div>
        )}

        <div className="mt-4 rounded-xl bg-stone-100 p-3 text-sm dark:bg-stone-800">
          <p className="text-stone-500">Deine Nutzer-ID (UID)</p>
          <p className="select-all break-all font-mono">{info.uid}</p>
          <button onClick={copyUid} className="mt-1 text-stone-500 underline">
            {copied ? 'Kopiert ✓' : 'Kopieren'}
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          {info.isAdmin && <PrimaryButton onClick={onOpenAdmin}>🛡️ Gästeliste verwalten</PrimaryButton>}
          <button onClick={onHome} className="text-sm text-stone-500 underline">
            Zur Startseite
          </button>
          <button onClick={() => signOut()} className="text-sm text-stone-500 underline">
            Abmelden
          </button>
        </div>
      </Card>
    </>
  )
}
