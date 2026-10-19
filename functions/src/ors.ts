import { UserFacingError, orsError } from './errors.js'
import type { HuntParams, LatLng } from './types.js'

const PROFILES: Record<HuntParams['mode'], string> = {
  foot: 'foot-walking',
  bike: 'cycling-regular',
}

/**
 * Weglängen in Metern zwischen allen Punkten (Zeile = von, Spalte = nach).
 * Nicht erreichbare Paare sind Infinity.
 */
export async function fetchDistanceMatrix(points: LatLng[], mode: HuntParams['mode'], apiKey: string): Promise<number[][]> {
  let res: Response
  try {
    res = await fetch(`https://api.openrouteservice.org/v2/matrix/${PROFILES[mode]}`, {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        locations: points.map((p) => [p.lng, p.lat]),
        metrics: ['distance'],
      }),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (e) {
    throw new UserFacingError(
      'unavailable',
      'ors_unavailable',
      'OpenRouteService ist gerade nicht erreichbar.',
      `In ein paar Minuten erneut versuchen. (${String(e)})`,
    )
  }
  if (!res.ok) throw orsError(res.status, await res.text())
  const data = (await res.json()) as { distances?: (number | null)[][] }
  if (!data.distances) throw orsError(500, 'Antwort ohne Distanzen')
  return data.distances.map((row) => row.map((d) => (d == null ? Infinity : d)))
}
