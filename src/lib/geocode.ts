import type { LatLng } from './geo'

export interface Place {
  label: string
  position: LatLng
}

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
}

/**
 * Ort oder Adresse suchen – über Nominatim (OpenStreetMap), kostenlos und ohne Schlüssel.
 * Nutzungsregeln: höchstens eine Anfrage pro Sekunde und keine Suche bei jedem Tastendruck –
 * deshalb wird nur auf ausdrücklichen Knopfdruck gesucht.
 */
export async function searchPlaces(query: string, fetchImpl: typeof fetch = fetch): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.search = new URLSearchParams({ q, format: 'jsonv2', limit: '5', 'accept-language': 'de' }).toString()
  const res = await fetchImpl(url.toString(), { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Ortssuche nicht erreichbar (HTTP ${res.status})`)
  const data = (await res.json()) as NominatimResult[]
  return data
    .map((r) => ({ label: r.display_name, position: { lat: Number(r.lat), lng: Number(r.lon) } }))
    .filter((p) => Number.isFinite(p.position.lat) && Number.isFinite(p.position.lng))
}

/** Land, Stadt und Ortsteil zu einem Punkt – leere Felder, wenn OpenStreetMap nichts weiß */
export interface PlaceName {
  country: string | null
  city: string | null
  district: string | null
}

interface NominatimReverse {
  address?: Record<string, string>
}

/** Wandelt die Adresse aus Nominatim in Land, Stadt und Ortsteil um (Großstadt, Kleinstadt oder Dorf) */
export function placeNameFromAddress(address: Record<string, string> = {}): PlaceName {
  const city = address.city ?? address.town ?? address.village ?? address.municipality ?? null
  const district =
    [address.suburb, address.city_district, address.borough, address.quarter, address.neighbourhood, address.hamlet].find(
      (d) => d && d !== city,
    ) ?? null
  return { country: address.country ?? null, city, district }
}

const PLACE_CACHE = 'schatzsuche.placeNames'

function readCache(): Record<string, PlaceName> {
  try {
    return JSON.parse(localStorage.getItem(PLACE_CACHE) ?? '{}') as Record<string, PlaceName>
  } catch {
    return {}
  }
}

/** Schlüssel auf rund 100 m gerundet – benachbarte Startpunkte teilen sich einen Eintrag */
const cacheKey = (p: LatLng) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`

export function cachedPlaceName(position: LatLng): PlaceName | undefined {
  return readCache()[cacheKey(position)]
}

/** Ortsname zu einem Punkt; einmal gefundene Namen merkt sich das Gerät */
export async function reversePlaceName(position: LatLng, fetchImpl: typeof fetch = fetch): Promise<PlaceName> {
  const cached = cachedPlaceName(position)
  if (cached) return cached
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.search = new URLSearchParams({
    lat: String(position.lat),
    lon: String(position.lng),
    format: 'jsonv2',
    zoom: '16',
    'accept-language': 'de',
  }).toString()
  const res = await fetchImpl(url.toString(), { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Ortsname nicht ermittelbar (HTTP ${res.status})`)
  const name = placeNameFromAddress(((await res.json()) as NominatimReverse).address)
  try {
    localStorage.setItem(PLACE_CACHE, JSON.stringify({ ...readCache(), [cacheKey(position)]: name }))
  } catch {
    // ohne Speicher wird beim nächsten Mal neu gefragt
  }
  return name
}
