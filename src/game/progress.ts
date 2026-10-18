import type { Hunt } from './types'

export type Phase = 'intro' | 'travel' | 'chapter' | 'riddle' | 'finished'

export interface Progress {
  huntId: string
  phase: Phase
  /** Index der aktuellen Station */
  index: number
  /** Anzahl aufgedeckter Tipps pro Station */
  hintsUsed: number[]
  wrongAnswers: number
  startedAt: number | null
  finishedAt: number | null
}

export type Action =
  | { type: 'start'; now: number }
  | { type: 'arrive' }
  | { type: 'openRiddle' }
  | { type: 'solve'; now: number }
  | { type: 'wrongAnswer' }
  | { type: 'revealHint' }
  | { type: 'reset' }

export function initialProgress(hunt: Hunt): Progress {
  return {
    huntId: hunt.id,
    phase: 'intro',
    index: 0,
    hintsUsed: hunt.stations.map(() => 0),
    wrongAnswers: 0,
    startedAt: null,
    finishedAt: null,
  }
}

export function reduceProgress(hunt: Hunt, state: Progress, action: Action): Progress {
  switch (action.type) {
    case 'start':
      return state.phase === 'intro' ? { ...state, phase: 'travel', startedAt: action.now } : state
    case 'arrive':
      return state.phase === 'travel' ? { ...state, phase: 'chapter' } : state
    case 'openRiddle':
      return state.phase === 'chapter' ? { ...state, phase: 'riddle' } : state
    case 'solve': {
      if (state.phase !== 'riddle') return state
      const last = state.index >= hunt.stations.length - 1
      return last
        ? { ...state, phase: 'finished', finishedAt: action.now }
        : { ...state, phase: 'travel', index: state.index + 1 }
    }
    case 'wrongAnswer':
      return state.phase === 'riddle' ? { ...state, wrongAnswers: state.wrongAnswers + 1 } : state
    case 'revealHint': {
      if (state.phase !== 'riddle' || state.hintsUsed[state.index] >= 2) return state
      const hintsUsed = [...state.hintsUsed]
      hintsUsed[state.index]++
      return { ...state, hintsUsed }
    }
    case 'reset':
      return initialProgress(hunt)
  }
}

const storageKey = (hunt: Hunt) => `schatzsuche.progress.${hunt.id}`

export function loadProgress(hunt: Hunt): Progress {
  try {
    const raw = localStorage.getItem(storageKey(hunt))
    if (raw) {
      const saved = JSON.parse(raw) as Progress
      const valid =
        saved.huntId === hunt.id &&
        saved.hintsUsed?.length === hunt.stations.length &&
        saved.index >= 0 &&
        saved.index < hunt.stations.length
      if (valid) return saved
    }
  } catch {
    // Speicher nicht verfügbar oder beschädigt – neu beginnen
  }
  return initialProgress(hunt)
}

export function saveProgress(hunt: Hunt, progress: Progress): void {
  try {
    localStorage.setItem(storageKey(hunt), JSON.stringify(progress))
  } catch {
    // Privater Modus o. Ä. – Fortschritt geht beim Neuladen verloren
  }
}
