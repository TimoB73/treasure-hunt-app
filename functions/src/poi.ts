import { UserFacingError } from './errors.js'
import { distanceMeters, distanceToPolyline } from './geo.js'
import type { HuntParams, LatLng, Poi } from './types.js'

const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
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
  return `[out:json][timeout:25];
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
}

export async function fetchOverpass(query: string): Promise<OverpassResult> {
  let lastError = ''
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(40_000),
      })
      if (res.ok) return (await res.json()) as OverpassResult
      lastError = `HTTP ${res.status}`
    } catch (e) {
      lastError = String(e)
    }
  }
  throw new UserFacingError(
    'unavailable',
    'overpass_unavailable',
    'Die Ortsdatenbank (OpenStreetMap/Overpass) ist gerade nicht erreichbar.',
    `In ein paar Minuten erneut versuchen. (${lastError})`,
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
export function extractPois(result: OverpassResult, params: Pick<HuntParams, 'age'>): Poi[] {
  const roads = result.elements
    .filter((e) => e.type === 'way' && e.geometry && e.tags?.highway)
    .map((e) => e.geometry!.map((p) => ({ lat: p.lat, lng: p.lon })))
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
