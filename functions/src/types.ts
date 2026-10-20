import { z } from 'zod'

export interface LatLng {
  lat: number
  lng: number
}

/** Eckdaten, die der Spielleiter im Formular angibt (Spiegel von src/game/generator.ts im Frontend) */
export const huntParamsSchema = z.object({
  start: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  durationMinutes: z.number().int().min(20).max(240),
  difficulty: z.enum(['leicht', 'mittel', 'schwer']),
  /** Alter des jüngsten Mitspielers */
  age: z.number().int().min(4).max(99),
  mode: z.enum(['foot', 'bike']),
  /** Anzahl Stationen inklusive gemeinsamem Ziel */
  stationCount: z.number().int().min(3).max(12),
  groupCount: z.number().int().min(1).max(10),
  staggerMinutes: z.number().int().min(0).max(60),
})

export type HuntParams = z.infer<typeof huntParamsSchema>

/** Ein geeigneter Ort aus OpenStreetMap */
export interface Poi {
  osmId: string
  position: LatLng
  kind: string
  /** Deutsche Bezeichnung der Ortsart, z. B. „Brunnen“ */
  kindLabel: string
  name: string | null
  tags: Record<string, string>
  score: number
}

export type AnswerSpec =
  | { type: 'number'; solution: number }
  | { type: 'choice'; options: string[]; solution: number }
  | { type: 'text'; solutions: string[] }

export interface Riddle {
  question: string
  answer: AnswerSpec
  hints: [string, string]
}

export interface Station {
  id: string
  name: string
  position: LatLng
  chapter: string
  riddle: Riddle
  kindLabel: string
  osmId: string
}

/** Dokument in Firestore unter hunts/{id}; die Felder von Hunt entsprechen src/game/types.ts */
export interface HuntDoc {
  id: string
  title: string
  intro: string
  outro: string
  radius: number
  /** Rundkurs-Stationen in Reihenfolge, das gemeinsame Ziel immer als letzte */
  stations: Station[]
  ownerUid: string
  createdAt: number
  params: HuntParams
  stats: {
    /** Geschätzte Weglänge für eine Gruppe in Metern */
    routeMeters: number
    estimatedMinutes: number
  }
}
