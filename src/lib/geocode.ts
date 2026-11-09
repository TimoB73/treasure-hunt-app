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
