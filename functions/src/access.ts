import { UserFacingError } from './errors.js'

/** Gespeichert unter allowlist/{normalisierte E-Mail}; nur Cloud Functions lesen und schreiben (Firestore-Regeln) */
export const ALLOWLIST = 'allowlist'
/** Admins: Dokument admins/{uid} – wird einmalig von Hand in der Firebase Console angelegt */
export const ADMINS = 'admins'

export const MAX_HUNTS_PER_MONTH = 10

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Was der Server über die anfragende Person weiß (aus dem geprüften ID-Token und Firestore) */
export interface Caller {
  uid: string
  email: string | null
  emailVerified: boolean
  /** Anmeldeart laut Token, z. B. password, google.com, anonymous */
  provider: string
  isAdmin: boolean
  isAllowed: boolean
}

/** Darf diese Person Jagden erstellen? Wirft sonst eine freundliche Meldung. */
export function assertCanCreate(caller: Caller): void {
  if (caller.provider === 'anonymous' || !caller.email) {
    throw new UserFacingError(
      'unauthenticated',
      'not_signed_in',
      'Zum Erstellen einer Jagd bitte anmelden.',
      'Oben rechts auf 👤 tippen und mit E-Mail und Passwort anmelden oder registrieren.',
    )
  }
  if (!caller.emailVerified) {
    throw new UserFacingError(
      'permission-denied',
      'email_unverified',
      'Bitte bestätige zuerst deine E-Mail-Adresse.',
      'Den Link in der Bestätigungs-E-Mail antippen (auch im Spam-Ordner nachsehen) und danach in der App „Ich habe bestätigt“ wählen.',
    )
  }
  if (!caller.isAdmin && !caller.isAllowed) {
    throw new UserFacingError(
      'permission-denied',
      'not_allowed',
      'Diese App ist privat – bitte beim Betreiber freischalten lassen.',
      `Dem Betreiber deine E-Mail-Adresse ${caller.email} nennen. Sobald sie freigeschaltet ist, kannst du sofort loslegen.`,
    )
  }
}

export function assertAdmin(caller: Caller): void {
  if (!caller.isAdmin || !caller.emailVerified) {
    throw new UserFacingError('permission-denied', 'not_admin', 'Dieser Bereich ist nur für den Betreiber.')
  }
}
