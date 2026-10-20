import { UserFacingError } from './errors.js'
import { angle } from './geo.js'
import type { HuntParams, LatLng, Poi } from './types.js'

export interface Budget {
  /** Zeit pro Station für Kapitel und Rätsel */
  stationMinutes: number
  metersPerMinute: number
  /** Angestrebte Weglänge pro Gruppe */
  targetMeters: number
  /** Mindestabstand (Weglänge) zwischen zwei Stationen */
  minSpacing: number
  /** Radius des Rundkurses um den Start (Luftlinie) */
  loopRadius: number
  /** Suchradius für Orte */
  searchRadius: number
}

const STATION_MINUTES = { leicht: 3, mittel: 4, schwer: 6 } as const

export function planBudget(p: HuntParams): Budget {
  const stationMinutes = STATION_MINUTES[p.difficulty] + (p.age < 10 ? 1 : 0)
  const metersPerMinute = p.mode === 'bike' ? (p.age < 12 ? 150 : 200) : p.age < 8 ? 50 : p.age < 12 ? 60 : 70
  const travelMinutes = p.durationMinutes - p.stationCount * stationMinutes
  if (travelMinutes < 10) {
    throw new UserFacingError(
      'invalid-argument',
      'duration_too_short',
      `${p.durationMinutes} Minuten reichen nicht für ${p.stationCount} Stationen.`,
      `Mindestens ${p.stationCount * stationMinutes + 10} Minuten wählen oder weniger Stationen.`,
    )
  }
  const targetMeters = travelMinutes * metersPerMinute
  const baseSpacing = p.mode === 'bike' ? 300 : p.age < 10 ? 120 : 150
  const minSpacing = Math.max(60, Math.min(baseSpacing, targetMeters / (p.stationCount * 1.5)))
  // Der Rundkurs ist ungefähr ein Kreis; Wege sind rund 30 % länger als die Luftlinie
  const loopRadius = targetMeters / 1.3 / (2 * Math.PI)
  const searchRadius = Math.min(Math.max(loopRadius * 1.6, 400), p.mode === 'bike' ? 8000 : 3000)
  return { stationMinutes, metersPerMinute, targetMeters, minSpacing, loopRadius, searchRadius }
}

/** Kleiner deterministischer Zufallsgenerator (mulberry32), damit Tests reproduzierbar sind */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface RoutePlan {
  /** Indizes in candidates: Stationen des Rundkurses in Laufrichtung */
  loop: number[]
  /** Index in candidates: gemeinsames Ziel */
  goal: number
  /** Weglänge je Gruppe (Gruppe g beginnt an Rundkurs-Station startOffset(g)) */
  groupMeters: number[]
}

/** An welcher Rundkurs-Station Gruppe g beginnt – gleichmäßig verteilt */
export function startOffset(group: number, groupCount: number, loopLength: number): number {
  return Math.floor((group * loopLength) / Math.max(groupCount, 1)) % loopLength
}

/**
 * Wählt aus den Kandidaten einen Rundkurs plus gemeinsames Ziel.
 * `matrix` enthält Weglängen; Index 0 ist der Startpunkt, Index i + 1 der Kandidat i.
 */
export function selectRoute(
  start: LatLng,
  candidates: Poi[],
  matrix: number[][],
  params: HuntParams,
  budget: Budget,
  random: () => number,
): RoutePlan {
  const d = (a: number, b: number) => matrix[a + 1][b + 1]
  const fromStart = (c: number) => matrix[0][c + 1]
  const toStart = (c: number) => matrix[c + 1][0]
  const apart = (a: number, b: number) => Math.min(d(a, b), d(b, a))

  const reachable = candidates.map((_, i) => i).filter((i) => Number.isFinite(fromStart(i)) && Number.isFinite(toStart(i)))
  if (reachable.length < params.stationCount) throw tooFewPlaces(params, reachable.length)

  // Ziel: gut bewerteter Ort nahe am Start, damit alle Gruppen dort zusammenkommen und der Rückweg kurz ist
  const nearLimit = Math.max(250, budget.loopRadius * 0.5)
  const near = reachable.filter((i) => fromStart(i) <= nearLimit)
  const goal = (near.length ? near : reachable).reduce((best, i) => {
    const value = (j: number) => candidates[j].score - fromStart(j) / nearLimit
    return value(i) > value(best) ? i : best
  })

  const loopSize = params.stationCount - 1
  const groupCount = Math.min(params.groupCount, loopSize)
  const maxScore = Math.max(...candidates.map((c) => c.score))

  const routeLengths = (loop: number[]) =>
    Array.from({ length: groupCount }, (_, g) => {
      const s = startOffset(g, groupCount, loop.length)
      let total = fromStart(loop[s])
      for (let step = 0; step < loop.length - 1; step++) {
        total += d(loop[(s + step) % loop.length], loop[(s + step + 1) % loop.length])
      }
      return total + d(loop[(s + loop.length - 1) % loop.length], goal)
    })

  const cycleLength = (loop: number[]) => loop.reduce((sum, c, i) => sum + d(c, loop[(i + 1) % loop.length]), 0)

  /** 2-opt: Kreuzungen im Rundkurs auflösen */
  const improve = (loop: number[]) => {
    let best = loop
    let bestLength = cycleLength(loop)
    let improved = true
    while (improved) {
      improved = false
      for (let i = 1; i < best.length - 1; i++) {
        for (let j = i + 1; j < best.length; j++) {
          const next = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)]
          const length = cycleLength(next)
          if (length < bestLength - 1) {
            best = next
            bestLength = length
            improved = true
          }
        }
      }
    }
    return best
  }

  for (const spacingFactor of [1, 0.6]) {
    const spacing = budget.minSpacing * spacingFactor
    const pool = reachable.filter((i) => i !== goal && apart(i, goal) >= spacing)
    if (pool.length < loopSize) continue

    let best: { loop: number[]; lengths: number[]; cost: number } | null = null
    for (let trial = 0; trial < 1500; trial++) {
      // Gewichtete Zufallsauswahl (Efraimidis–Spirakis), dabei Mindestabstände einhalten
      const order = pool
        .map((i) => ({ i, key: random() ** (1 / Math.max(candidates[i].score, 0.1)) }))
        .sort((a, b) => b.key - a.key)
      const chosen: number[] = []
      for (const { i } of order) {
        if (chosen.every((c) => apart(c, i) >= spacing)) chosen.push(i)
        if (chosen.length === loopSize) break
      }
      if (chosen.length < loopSize) continue

      chosen.sort((a, b) => angle(start, candidates[a].position) - angle(start, candidates[b].position))
      const loop = improve(chosen)
      const lengths = routeLengths(loop)
      if (lengths.some((l) => !Number.isFinite(l))) continue
      const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length
      const spread = Math.max(...lengths) - Math.min(...lengths)
      const meanScore = [...loop, goal].reduce((sum, i) => sum + candidates[i].score, 0) / (loop.length + 1)
      const kinds = [...loop, goal].map((i) => candidates[i].kind)
      const duplicates = kinds.length - new Set(kinds).size

      const cost =
        Math.abs(mean - budget.targetMeters) / budget.targetMeters +
        (0.3 * spread) / budget.targetMeters +
        0.3 * (1 - meanScore / maxScore) +
        0.04 * duplicates
      if (!best || cost < best.cost) best = { loop, lengths, cost }
    }
    if (best) return { loop: best.loop, goal, groupMeters: best.lengths }
  }
  throw tooFewPlaces(params, reachable.length)
}

function tooFewPlaces(params: HuntParams, found: number): UserFacingError {
  return new UserFacingError(
    'failed-precondition',
    'too_few_places',
    `In der Umgebung gibt es nur ${found} geeignete Orte mit genug Abstand – für ${params.stationCount} Stationen reicht das nicht.`,
    'Weniger Stationen, eine längere Dauer oder einen Startpunkt näher an Ortskern oder Park wählen.',
  )
}
