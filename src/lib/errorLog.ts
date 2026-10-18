const KEY = 'schatzsuche.errors'
const MAX_ENTRIES = 5

export interface LoggedError {
  at: number
  message: string
}

export function readErrors(): LoggedError[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as LoggedError[]
  } catch {
    return []
  }
}

export function logError(message: string): void {
  try {
    const entries = [...readErrors(), { at: Date.now(), message: message.slice(0, 500) }].slice(-MAX_ENTRIES)
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // ohne Speicher kein Protokoll
  }
}

export function clearErrors(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignorieren
  }
}

/** Fängt Fehler außerhalb von React ab (z. B. aus Leaflet), damit sie im Testmodus sichtbar sind */
export function installGlobalErrorLog(): void {
  window.addEventListener('error', (e) => logError(e.message || String(e.error)))
  window.addEventListener('unhandledrejection', (e) => logError(`Promise: ${String(e.reason)}`))
}
