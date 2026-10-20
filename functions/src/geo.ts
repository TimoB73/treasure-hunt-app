import type { LatLng } from './types.js'

const EARTH_RADIUS_M = 6_371_000
const toRad = (deg: number) => (deg * Math.PI) / 180

/** Luftlinie in Metern (Haversine) */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/** Kürzester Abstand eines Punkts zu einer Linie in Metern (lokal eben gerechnet, für kurze Strecken genau genug) */
export function distanceToPolyline(p: LatLng, line: LatLng[]): number {
  const kx = EARTH_RADIUS_M * toRad(1) * Math.cos(toRad(p.lat))
  const ky = EARTH_RADIUS_M * toRad(1)
  const project = (q: LatLng) => ({ x: (q.lng - p.lng) * kx, y: (q.lat - p.lat) * ky })
  let best = Infinity
  for (let i = 0; i < line.length; i++) {
    const a = project(line[i])
    if (line.length === 1) return Math.hypot(a.x, a.y)
    if (i === line.length - 1) break
    const b = project(line[i + 1])
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2))
    best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy))
  }
  return best
}

/** Winkel von a nach b in Bogenmaß (für die Sortierung im Kreis um den Start) */
export function angle(a: LatLng, b: LatLng): number {
  return Math.atan2(b.lat - a.lat, (b.lng - a.lng) * Math.cos(toRad(a.lat)))
}
