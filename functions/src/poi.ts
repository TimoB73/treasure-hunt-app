import { UserFacingError } from './errors.js'
import { distanceMeters, distanceToPolyline } from './geo.js'
import type { HuntParams, LatLng, Poi } from './types.js'

/**
 * Öffentliche Overpass-Server. Der Hauptserver ist zeitweise überlastet,
 * daher wird nacheinander auf gleichwertige Spiegelserver ausgewichen.
 */
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]
export interface OverpassOptions {
  fetchImpl?: typeof fetch
  /** Abstand, mit dem der jeweils nächste Server zusätzlich gefragt wird */
  staggerMs?: number
  /** Höchste Wartezeit je Anfrage – Spiegelserver sind oft langsam, aber zuverlässig */
  timeoutMs?: number
  /** Pause vor dem zweiten Durchgang, falls alle Server versagen */
  retryDelayMs?: number
  /** Wird aufgerufen, sobald auf Ersatzserver ausgewichen werden muss (für die Fortschrittsanzeige) */
  onFallback?: () => void
}
const USER_AGENT = 'Schatzsuche-App/0.2 (Cloud Function; https://github.com/timob73/treasure-hunt-app)'

interface Category {
  kind: string
  label: string
  /** Overpass-Filter, z. B. [amenity=fountain] */
  filter: string
  /** Grundpunktzahl: wie gut eignet sich die Ortsart als Station */
  score: (age: number) => number
}

const CATEGORIES: Category[] = [
  { kind: 'fountain', label: 'Brunnen', filter: '[amenity=fountain]', score: () => 3 },
  { kind: 'memorial', label: 'Denkmal', filter: '[historic~"^(memorial|monument)$"]', score: () => 3 },
  { kind: 'statue', label: 'Statue', filter: '[historic=statue]', score: () => 3 },
  { kind: 'wayside', label: 'Wegkreuz', filter: '[historic~"^(wayside_cross|wayside_shrine)$"]', score: () => 2 },
  { kind: 'artwork', label: 'Kunstwerk', filter: '[tourism=artwork]', score: () => 3 },
  { kind: 'viewpoint', label: 'Aussichtspunkt', filter: '[tourism=viewpoint]', score: () => 3.5 },
  { kind: 'playground', label: 'Spielplatz', filter: '[leisure=playground]', score: (age) => (age < 12 ? 4 : 1) },
  { kind: 'park', label: 'Park', filter: '[leisure=park]', score: () => 2 },
  { kind: 'worship', label: 'Kirche', filter: '[amenity=place_of_worship]', score: () => 2.5 },
]

/** Hauptverkehrsstraßen, an denen keine Station liegen darf */
const MAJOR_ROADS = '^(motorway|trunk|primary|secondary)(_link)?$'

/** Große Parks taugen nicht als Treffpunkt: Ihr Mittelpunkt kann im Gebüsch oder See liegen */
const MAX_AREA_DIAGONAL_M = 400

/** Tags, die als belegte Fakten ans Modell gehen dürfen */
export const FACT_TAGS = [
  'name',
  'description',
  'inscription',
  'start_date',
  'artist_name',
  'artwork_type',
  'material',
  'memorial',
  'subject',
  'height',
  'ele',
  'denomination',
  'religion',
  'operator',
  'architect',
  'heritage',
  'wikipedia',
]

export function buildOverpassQuery(center: LatLng, radius: number): string {
  const around = `(around:${Math.round(radius)},${center.lat.toFixed(6)},${center.lng.toFixed(6)})`
  const pois = CATEGORIES.map((c) => `  nwr${around}${c.filter};`).join('\n')
  return `[out:json][timeout:40];
(
${pois}
);
out center bb tags;
way${around}[highway~"${MAJOR_ROADS}"];
out geom;`
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number }
  geometry?: { lat: number; lon: number }[]
  tags?: Record<string, string>
}

export interface OverpassResult {
  elements: OverpassElement[]
  /** Hinweis des Servers, z. B. bei Zeitüberschreitung der Abfrage */
  remark?: string
}

/**
 * Fragt die Overpass-Server zeitversetzt parallel ab und nimmt die erste brauchbare Antwort.
 * Liefert kein Server, folgt nach kurzer Pause ein zweiter Durchgang.
 */
export async function fetchOverpass(query: string, options: OverpassOptions = {}): Promise<OverpassResult> {
  const { fetchImpl = fetch, staggerMs = 4_000, timeoutMs = 50_000, retryDelayMs = 10_000, onFallback } = options
  const failures: string[] = []
  let fellBack = false
  const fallback = () => {
    if (!fellBack) onFallback?.()
    fellBack = true
  }

  const ask = async (endpoint: string, signal: AbortSignal): Promise<OverpassResult | null> => {
    const host = new URL(endpoint).host
    try {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      })
      if (!res.ok) {
        failures.push(`${host}: HTTP ${res.status}`)
        return null
      }
      const data = (await res.json()) as OverpassResult
      // Überlastete Server antworten manchmal mit 200, aber mit abgebrochener Abfrage
      if (Array.isArray(data.elements) && !data.remark?.includes('runtime error')) return data
      failures.push(`${host}: ${data.remark ?? 'leere Antwort'}`)
    } catch (e) {
      if (signal.aborted) return null // ein anderer Server war schneller
      failures.push(`${host}: ${e instanceof Error && e.name === 'TimeoutError' ? 'keine Antwort' : String(e)}`)
    }
    return null
  }

  /** Ein Durchgang: Server nacheinander hinzunehmen; die erste gute Antwort gewinnt */
  const round = () =>
    new Promise<OverpassResult | null>((resolve) => {
      const controller = new AbortController()
      const timers: ReturnType<typeof setTimeout>[] = []
      let pending = OVERPASS_ENDPOINTS.length
      let done = false
      const startAt: (() => void)[] = []
      const finish = (result: OverpassResult | null) => {
        if (done) return
        done = true
        timers.forEach(clearTimeout)
        controller.abort()
        resolve(result)
      }
      OVERPASS_ENDPOINTS.forEach((endpoint, i) => {
        const start = () => {
          if (done) return
          if (i > 0) fallback()
          ask(endpoint, controller.signal).then((result) => {
            if (result) finish(result)
            else {
              // Fällt ein Server aus, sofort den nächsten zuschalten statt auf den Takt zu warten
              const next = timers[i + 1]
              if (next !== undefined) {
                clearTimeout(next)
                startAt[i + 1]()
              }
              if (--pending === 0) finish(null)
            }
          })
        }
        startAt[i] = () => {
          startAt[i] = () => undefined
          start()
        }
        timers[i] = setTimeout(() => startAt[i](), i * staggerMs)
      })
    })

  const first = await round()
  if (first) return first
  console.warn('Overpass: erster Durchgang ohne Ergebnis', failures)
  fallback()
  await new Promise((r) => setTimeout(r, retryDelayMs))
  failures.length = 0
  const second = await round()
  if (second) return second

  throw new UserFacingError(
    'unavailable',
    'overpass_unavailable',
    'Die Ortsdatenbank (OpenStreetMap/Overpass) ist gerade überlastet – auch nach zwei Durchgängen hat kein Server geantwortet.',
    `In 15–30 Minuten erneut versuchen. Das liegt nicht an deinen Eingaben. (${failures.join('; ')})`,
  )
}

function categoryOf(tags: Record<string, string>): Category | undefined {
  return CATEGORIES.find((c) => {
    // Filter der Form [key=value] oder [key~"^(a|b)$"] lokal nachbilden
    const m = c.filter.match(/^\[(\w+)(=|~)"?([^"\]]+)"?\]$/)
    if (!m) return false
    const value = tags[m[1]]
    if (value == null) return false
    return m[2] === '=' ? value === m[3] : new RegExp(m[3]).test(value)
  })
}

/** Mindestabstand einer Station zu Hauptverkehrsstraßen in Metern */
export function roadClearance(params: Pick<HuntParams, 'age'>): number {
  return params.age < 10 ? 40 : 25
}

/** Wandelt die Overpass-Antwort in bewertete, sichere Orte um */
function majorRoads(result: OverpassResult): LatLng[][] {
  return result.elements
    .filter((e) => e.type === 'way' && e.geometry && e.tags?.highway)
    .map((e) => e.geometry!.map((p) => ({ lat: p.lat, lng: p.lon })))
}

/** Liegt der Punkt zu nah an einer Hauptverkehrsstraße? (Die Abfrage muss den Punkt abdecken.) */
export function isNearMajorRoad(result: OverpassResult, point: LatLng, params: Pick<HuntParams, 'age'>): boolean {
  const clearance = roadClearance(params)
  return majorRoads(result).some((road) => distanceToPolyline(point, road) < clearance)
}

export function extractPois(result: OverpassResult, params: Pick<HuntParams, 'age'>): Poi[] {
  const roads = majorRoads(result)
  const clearance = roadClearance(params)

  const pois: Poi[] = []
  for (const el of result.elements) {
    const tags = el.tags ?? {}
    if (tags.highway) continue
    const category = categoryOf(tags)
    if (!category) continue
    const point = el.type === 'node' ? { lat: el.lat!, lng: el.lon! } : el.center && { lat: el.center.lat, lng: el.center.lon }
    if (!point || !Number.isFinite(point.lat)) continue
    if (/^(private|no|customers)$/.test(tags.access ?? '')) continue
    if (tags.disused || tags.abandoned || tags['disused:amenity']) continue
    // Stolpersteine sind Gedenkorte für Opfer des Nationalsozialismus – kein Spielort
    if (tags.memorial === 'stolperstein') continue
    if (el.bounds) {
      const diagonal = distanceMeters(
        { lat: el.bounds.minlat, lng: el.bounds.minlon },
        { lat: el.bounds.maxlat, lng: el.bounds.maxlon },
      )
      if (diagonal > MAX_AREA_DIAGONAL_M) continue
    }
    if (roads.some((road) => distanceToPolyline(point, road) < clearance)) continue

    const name = tags.name?.trim() || null
    let score = category.score(params.age)
    if (name) score += 1
    if (tags.wikipedia || tags.wikidata) score += 1.5
    if (tags.inscription) score += 0.5
    if (tags.start_date) score += 0.3
    // Unbenannte Parks und Kirchen ohne Namen sind schwer zu beschreiben
    if (!name && (category.kind === 'park' || category.kind === 'worship')) score -= 1.5

    pois.push({
      osmId: `${el.type}/${el.id}`,
      position: point,
      kind: category.kind,
      kindLabel: category.label,
      name,
      tags: Object.fromEntries(Object.entries(tags).filter(([k]) => FACT_TAGS.includes(k))),
      score,
    })
  }
  return pois
}

/**
 * Entfernt Orte, die zu dicht an einem besser bewerteten liegen (z. B. Brunnen im Park),
 * und behält höchstens `limit` Stück.
 */
export function thinOut(pois: Poi[], minDistance: number, limit: number): Poi[] {
  const sorted = [...pois].sort((a, b) => b.score - a.score)
  const kept: Poi[] = []
  for (const poi of sorted) {
    if (kept.some((k) => distanceMeters(k.position, poi.position) < minDistance)) continue
    kept.push(poi)
    if (kept.length >= limit) break
  }
  return kept
}
