import { FirebaseError } from 'firebase/app'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'
import { GeneratorError, toGeneratorError } from '../game/generator'
import { auth, functions } from './firebase'

/** Antwort der Cloud Function getAccount – Freischaltung und Rolle prüft nur der Server */
export interface AccountInfo {
  uid: string
  email: string | null
  emailVerified: boolean
  isAdmin: boolean
  isAllowed: boolean
  huntsThisMonth: number
  /** null = kein Limit (Admin) */
  monthlyLimit: number | null
}

export type AccountState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'unverified'; user: User }
  | { status: 'ready'; user: User; info: AccountInfo }
  | { status: 'error'; user: User; error: GeneratorError }

/* ---------- Ablösung der früheren anonymen Anmeldung ---------- */

const PENDING_ANON = 'schatzsuche.anonToken'

/**
 * Vor dem Anmelden: Wer die App früher anonym genutzt hat, hat Jagden unter einer anonymen Nutzer-ID.
 * Das ID-Token dieser Sitzung merken wir uns, damit der Server die Jagden danach ins neue Konto übernimmt.
 */
async function rememberAnonymousSession(): Promise<void> {
  const user = auth.currentUser
  if (!user?.isAnonymous) return
  try {
    sessionStorage.setItem(PENDING_ANON, await user.getIdToken())
  } catch {
    // ohne Token keine Übernahme – kein Beinbruch
  }
}

async function claimAnonymousHunts(): Promise<void> {
  let token: string | null = null
  try {
    token = sessionStorage.getItem(PENDING_ANON)
  } catch {
    return
  }
  if (!token) return
  try {
    await httpsCallable(functions, 'claimAnonymousHunts')({ anonIdToken: token })
  } catch (e) {
    console.warn('Übernahme der anonymen Jagden fehlgeschlagen', e)
  } finally {
    try {
      sessionStorage.removeItem(PENDING_ANON)
    } catch {
      // ignorieren
    }
  }
}

/* ---------- Anmelden, Registrieren, Passwort ---------- */

const AUTH_MESSAGES: Record<string, [string, string?]> = {
  'auth/invalid-credential': ['E-Mail oder Passwort stimmt nicht.', 'Vertippt? Sonst „Passwort vergessen“ nutzen.'],
  'auth/wrong-password': ['E-Mail oder Passwort stimmt nicht.', 'Vertippt? Sonst „Passwort vergessen“ nutzen.'],
  'auth/user-not-found': ['Zu dieser E-Mail gibt es kein Konto.', 'Unter „Registrieren“ ein Konto anlegen.'],
  'auth/email-already-in-use': ['Für diese E-Mail gibt es schon ein Konto.', 'Unter „Anmelden“ einloggen.'],
  'auth/weak-password': ['Das Passwort ist zu schwach.', 'Mindestens 8 Zeichen verwenden.'],
  'auth/invalid-email': ['Das ist keine gültige E-Mail-Adresse.'],
  'auth/missing-password': ['Bitte ein Passwort eingeben.'],
  'auth/too-many-requests': ['Zu viele Versuche.', 'Ein paar Minuten warten und erneut versuchen.'],
  'auth/network-request-failed': ['Keine Internetverbindung.', 'Verbindung prüfen und erneut versuchen.'],
  'auth/operation-not-allowed': [
    'Diese Anmeldeart ist noch nicht aktiviert.',
    'In der Firebase Console unter Authentication → Anmeldemethode aktivieren.',
  ],
  'auth/unauthorized-domain': [
    'Diese Internetadresse ist für die Anmeldung nicht freigegeben.',
    'In der Firebase Console unter Authentication → Einstellungen → Autorisierte Domains die Adresse der App eintragen.',
  ],
  'auth/account-exists-with-different-credential': [
    'Für diese E-Mail gibt es schon ein Konto mit Passwort.',
    'Mit E-Mail und Passwort anmelden.',
  ],
}

function authError(error: unknown): GeneratorError {
  if (error instanceof FirebaseError && AUTH_MESSAGES[error.code]) {
    const [message, action] = AUTH_MESSAGES[error.code]
    return new GeneratorError(message, action, error.code)
  }
  return toGeneratorError(error)
}

/** Nach der Bestätigung zurück in die App */
const continueUrl = () => ({ url: `${window.location.origin}/?konto` })

export async function signUp(email: string, password: string): Promise<void> {
  try {
    await rememberAnonymousSession()
    const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password)
    await sendEmailVerification(user, continueUrl())
  } catch (e) {
    throw authError(e)
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  try {
    await rememberAnonymousSession()
    await signInWithEmailAndPassword(auth, email.trim(), password)
  } catch (e) {
    throw authError(e)
  }
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    await rememberAnonymousSession()
    await signInWithPopup(auth, provider)
  } catch (e) {
    if (e instanceof FirebaseError && e.code === 'auth/popup-closed-by-user') return
    // Manche Handys (v. a. als App vom Startbildschirm) blockieren Popups – dann per Weiterleitung
    if (e instanceof FirebaseError && e.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider)
      return
    }
    throw authError(e)
  }
}

export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim(), continueUrl())
  } catch (e) {
    // Aus Datenschutzgründen nicht verraten, ob es ein Konto gibt
    if (e instanceof FirebaseError && e.code === 'auth/user-not-found') return
    throw authError(e)
  }
}

export async function resendVerification(): Promise<void> {
  if (!auth.currentUser) return
  try {
    await sendEmailVerification(auth.currentUser, continueUrl())
  } catch (e) {
    throw authError(e)
  }
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

/** Nach dem Klick auf den Bestätigungslink: Nutzerdaten und Token neu laden, damit der Server die Bestätigung sieht */
export async function refreshAccount(): Promise<void> {
  if (!auth.currentUser) return
  await auth.currentUser.reload()
  await auth.currentUser.getIdToken(true)
}

/* ---------- Konto-Status ---------- */

async function fetchAccountInfo(): Promise<AccountInfo> {
  const result = await httpsCallable<void, AccountInfo>(functions, 'getAccount')()
  return result.data
}

/** Verfolgt Anmeldung und Freischaltung. Anonyme Sitzungen von früher gelten als abgemeldet. */
export function useAccount(): [AccountState, () => void] {
  const [state, setState] = useState<AccountState>({ status: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    // Ergebnis einer Google-Anmeldung per Weiterleitung abholen (Fehler zeigt das Formular nicht – selten)
    getRedirectResult(auth).catch(() => undefined)

    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!user || user.isAnonymous) {
        if (active) setState({ status: 'signedOut' })
        return
      }
      await claimAnonymousHunts()
      if (!user.emailVerified) {
        if (active) setState({ status: 'unverified', user })
        return
      }
      try {
        const info = await fetchAccountInfo()
        if (active) setState({ status: 'ready', user, info })
      } catch (e) {
        if (active) setState({ status: 'error', user, error: toGeneratorError(e) })
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [version])

  // Neu laden, z. B. nach einer Jagd (Kontingent) oder wenn der Admin die Liste geändert hat
  return [state, () => setVersion((v) => v + 1)]
}

/** Darf das Konto Jagden erstellen? (nur Anzeige – der Server prüft selbst) */
export function canCreate(state: AccountState): boolean {
  return state.status === 'ready' && state.info.isAllowed
}

/* ---------- Gästeliste (nur Admins; der Server prüft die Rolle) ---------- */

export interface AllowlistEntry {
  email: string
  addedAt: number | null
}

type AllowlistRequest = { action: 'list' } | { action: 'add' | 'remove'; email: string }

export async function manageAllowlist(request: AllowlistRequest): Promise<AllowlistEntry[]> {
  try {
    const result = await httpsCallable<AllowlistRequest, { emails: AllowlistEntry[] }>(functions, 'manageAllowlist')(
      request,
    )
    return result.data.emails
  } catch (e) {
    throw toGeneratorError(e)
  }
}
