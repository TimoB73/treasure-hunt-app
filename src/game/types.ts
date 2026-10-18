import type { AnswerSpec } from '../lib/answer'
import type { LatLng } from '../lib/geo'

export interface Riddle {
  question: string
  answer: AnswerSpec
  hints: [string, string]
}

export interface Station {
  id: string
  name: string
  position: LatLng
  /** Zwischenkapitel, das bei Ankunft erscheint */
  chapter: string
  riddle: Riddle
}

export interface Hunt {
  id: string
  title: string
  intro: string
  outro: string
  /** Geofence-Radius in Metern */
  radius: number
  stations: Station[]
}
