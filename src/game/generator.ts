import { FirebaseError } from 'firebase/app'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions } from '../lib/firebase'
import type { LatLng } from '../lib/geo'
import type { Genre } from './genres'
import type { Hunt, Station } from './types'

/** Eckdaten für den Generator (Spiegel von functions/src/types.ts) */
export interface HuntParams {
  start: LatLng
  /** Selbst gewählter Zielpunkt; ohne wählt der Generator einen Ort nahe am Start */
  goal?: LatLng
  durationMinutes: number
  difficulty: 'leicht' | 'mittel' | 'schwer'
  /** Alter des jüngsten Mitspielers */
  age: number
  mode: 'foot' | 'bike'
  /** Anzahl Stationen inklusive gemeinsamem Ziel */
  stationCount: number
  groupCount: number
  staggerMinutes: number
  /** Fehlt bei Jagden, die vor Einführung der Genres erzeugt wurden */
  genre?: Genre
}

export interface GeneratedStation extends Station {
  kindLabel: string
  osmId: string
}

/** Eine erzeugte Jagd, wie sie in Firestore unter hunts/{id} liegt */
export interface GeneratedHunt extends Hunt {
  stations: GeneratedStation[]
  ownerUid: string
  createdAt: number
  params: HuntParams
  stats: { routeMeters: number; estimatedMinutes: number }
}

/** Verständliche Fehlermeldung mit Handlungsanweisung */
export class GeneratorError extends Error {
  constructor(
    message: string,
    readonly action?: string,
    readonly reason?: string,
  ) {
    super(message)
  }
}

export function toGeneratorError(error: unknown): GeneratorError {
  if (error instanceof GeneratorError) return error
  if (error instanceof FirebaseError) {
    const details = (error as FirebaseError & { details?: { reason?: string; action?: string } }).details
    if (details?.reason) return new GeneratorError(error.message, details.action, details.reason)
    switch (error.code) {
      case 'functions/deadline-exceeded':
        return new GeneratorError(
          'Das Erzeugen dauert länger als erwartet.',
          'In ein paar Minuten unter „Meine Jagden“ nachsehen – die Jagd wird im Hintergrund fertiggestellt.',
        )
      case 'functions/unauthenticated':
        return new GeneratorError('Bitte zuerst anmelden.', 'Oben rechts auf 👤 tippen.')
      case 'auth/network-request-failed':
      case 'functions/unavailable':
        return new GeneratorError('Keine Verbindung zum Server.', 'Internetverbindung prüfen und erneut versuchen.')
      case 'permission-denied':
        return new GeneratorError(
          'Kein Zugriff auf die gespeicherten Jagden.',
          'Die Firestore-Regeln sind noch nicht deployt: firebase deploy --only firestore (siehe README).',
        )
      case 'unavailable':
        return new GeneratorError(
          'Keine Verbindung zur Datenbank.',
          'Internetverbindung prüfen. Einmal geladene Jagden funktionieren auch offline.',
        )
      case 'functions/internal':
      case 'functions/not-found':
        return new GeneratorError(
          'Der Generator auf dem Server ist nicht erreichbar.',
          'Prüfen, ob die Cloud Function „generateHunt“ in europe-west3 deployt ist (siehe README, Abschnitt Cloud Functions).',
        )
    }
    return new GeneratorError(error.message)
  }
  return new GeneratorError(String(error))
}

export async function generateHunt(params: HuntParams): Promise<string> {
  try {
    // Claude braucht für Story und Rätsel ein bis drei Minuten
    const call = httpsCallable<HuntParams, { huntId: string }>(functions, 'generateHunt', { timeout: 540_000 })
    const result = await call(params)
    return result.data.huntId
  } catch (error) {
    throw toGeneratorError(error)
  }
}

/** Lädt eine Jagd per ID – auch ohne Konto, damit Mitspieler nur den Link brauchen */
export async function loadHunt(id: string): Promise<GeneratedHunt | null> {
  try {
    const snap = await getDoc(doc(db, 'hunts', id))
    return snap.exists() ? (snap.data() as GeneratedHunt) : null
  } catch (error) {
    throw toGeneratorError(error)
  }
}

/** Alle Jagden des angemeldeten Kontos */
export async function loadMyHunts(): Promise<GeneratedHunt[]> {
  try {
    const uid = auth.currentUser?.uid
    if (!uid || auth.currentUser?.isAnonymous) return []
    const snap = await getDocs(query(collection(db, 'hunts'), where('ownerUid', '==', uid)))
    return snap.docs.map((d) => d.data() as GeneratedHunt).sort((a, b) => b.createdAt - a.createdAt)
  } catch (error) {
    throw toGeneratorError(error)
  }
}
