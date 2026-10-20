import Anthropic from '@anthropic-ai/sdk'
import type { FunctionsErrorCode } from 'firebase-functions/v2/https'

/**
 * Fehler mit verständlicher Meldung für den Spielleiter.
 * `action` sagt, was zu tun ist; `reason` ist eine maschinenlesbare Kennung fürs Frontend.
 */
export class UserFacingError extends Error {
  constructor(
    readonly code: FunctionsErrorCode,
    readonly reason: string,
    message: string,
    readonly action?: string,
  ) {
    super(message)
  }
}

const ANTHROPIC_CONSOLE = 'https://console.anthropic.com'
const SECRET_HINT = (name: string) =>
  `Neuen Schlüssel hinterlegen: firebase functions:secrets:set ${name} – danach die Functions neu deployen.`

/** Übersetzt Fehler der Claude-API in eine Meldung mit Handlungsanweisung */
export function anthropicError(error: unknown): UserFacingError {
  if (error instanceof Anthropic.AuthenticationError) {
    return new UserFacingError(
      'failed-precondition',
      'anthropic_key_invalid',
      'Der Claude-API-Schlüssel ist ungültig oder wurde widerrufen.',
      `In ${ANTHROPIC_CONSOLE} unter „API Keys“ einen gültigen Schlüssel erzeugen. ${SECRET_HINT('ANTHROPIC_API_KEY')}`,
    )
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new UserFacingError(
      'failed-precondition',
      'anthropic_permission',
      'Der Claude-API-Schlüssel hat keine Berechtigung für dieses Modell.',
      `In ${ANTHROPIC_CONSOLE} prüfen, ob der Schlüssel zum richtigen Workspace gehört und das Modell freigeschaltet ist.`,
    )
  }
  if (error instanceof Anthropic.APIError) {
    const message = (error.message ?? '').toLowerCase()
    // Fehlendes Guthaben: neuer Fehlertyp billing_error (402), ältere Antworten als 400 mit Hinweistext
    if (error.status === 402 || error.type === 'billing_error' || message.includes('credit balance')) {
      return new UserFacingError(
        'failed-precondition',
        'anthropic_credit',
        'Das Guthaben bei Anthropic ist aufgebraucht.',
        `In ${ANTHROPIC_CONSOLE} unter „Billing“ Guthaben aufladen. Danach funktioniert die Erstellung sofort wieder.`,
      )
    }
    if (message.includes('usage limit') || message.includes('spend limit')) {
      return new UserFacingError(
        'failed-precondition',
        'anthropic_spend_limit',
        'Das in der Anthropic-Konsole gesetzte Ausgabenlimit ist erreicht.',
        `In ${ANTHROPIC_CONSOLE} unter „Limits“ das Monatslimit erhöhen oder bis zum nächsten Monat warten.`,
      )
    }
    if (error instanceof Anthropic.RateLimitError) {
      return new UserFacingError(
        'resource-exhausted',
        'anthropic_rate_limit',
        'Claude ist gerade ausgelastet (zu viele Anfragen).',
        'In ein bis zwei Minuten erneut versuchen.',
      )
    }
    if (error instanceof Anthropic.NotFoundError) {
      return new UserFacingError(
        'failed-precondition',
        'anthropic_model',
        'Das Claude-Modell ist für dieses Konto nicht verfügbar.',
        `In ${ANTHROPIC_CONSOLE} prüfen, welche Modelle freigeschaltet sind.`,
      )
    }
    if (error.status === 529 || (error.status ?? 0) >= 500 || error instanceof Anthropic.APIConnectionError) {
      return new UserFacingError(
        'unavailable',
        'anthropic_unavailable',
        'Claude ist gerade nicht erreichbar.',
        'In ein paar Minuten erneut versuchen.',
      )
    }
  }
  return new UserFacingError(
    'internal',
    'anthropic_unknown',
    'Beim Schreiben der Geschichte ist ein unerwarteter Fehler aufgetreten.',
    'Erneut versuchen. Bleibt der Fehler, in den Function-Logs nachsehen (firebase functions:log).',
  )
}

/** Übersetzt HTTP-Fehler von OpenRouteService */
export function orsError(status: number, body: string): UserFacingError {
  if (status === 401 || status === 403) {
    return new UserFacingError(
      'failed-precondition',
      'ors_key_invalid',
      'Der OpenRouteService-Schlüssel ist ungültig oder fehlt.',
      `Unter https://openrouteservice.org/dev/#/home (Dashboard → Tokens) den Schlüssel prüfen. ${SECRET_HINT('OPENROUTESERVICE_API_KEY')}`,
    )
  }
  if (status === 429) {
    return new UserFacingError(
      'resource-exhausted',
      'ors_quota',
      'Das Kontingent bei OpenRouteService ist für heute (oder diese Minute) aufgebraucht.',
      'Etwas später erneut versuchen. Das kostenlose Kontingent erneuert sich täglich; den Stand zeigt das Dashboard auf openrouteservice.org.',
    )
  }
  return new UserFacingError(
    'unavailable',
    'ors_unavailable',
    `OpenRouteService hat mit einem Fehler geantwortet (HTTP ${status}).`,
    `Später erneut versuchen. Details: ${body.slice(0, 200)}`,
  )
}

export function missingSecret(name: string): UserFacingError {
  return new UserFacingError(
    'failed-precondition',
    'secret_missing',
    `Der Schlüssel ${name} ist nicht hinterlegt.`,
    SECRET_HINT(name),
  )
}
