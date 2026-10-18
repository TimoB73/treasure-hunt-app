import type { GeoState } from '../hooks/useGeolocation'
import { bearingDegrees, directionName, distanceMeters, formatDistance } from '../lib/geo'
import type { Station } from '../game/types'
import { Card } from './Card'

interface Props {
  target: Station
  stationNumber: number
  stationCount: number
  geo: GeoState
  radius: number
  onRecenter: () => void
}

export function NavigationPanel({ target, stationNumber, stationCount, geo, radius, onRecenter }: Props) {
  const { position, accuracy, error } = geo
  const distance = position ? distanceMeters(position, target.position) : null
  const direction = position ? directionName(bearingDegrees(position, target.position)) : null
  const poorAccuracy = accuracy != null && accuracy > radius

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-stone-500">
            Station {stationNumber} von {stationCount}
          </p>
          <h2 className="text-lg font-semibold">{target.name}</h2>
        </div>
        <button
          onClick={onRecenter}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm dark:border-stone-700"
        >
          Zentrieren
        </button>
      </div>

      {distance != null ? (
        <p className="mt-3 text-3xl font-bold tabular-nums">
          {formatDistance(distance)} <span className="text-base font-normal text-stone-500">Richtung {direction}</span>
        </p>
      ) : (
        <p className="mt-3 text-stone-500">{error ?? 'Standort wird ermittelt …'}</p>
      )}

      <p className="mt-1 text-sm text-stone-500">Geh näher als {radius} m an die Markierung heran.</p>

      {error && distance != null && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {poorAccuracy && (
        <p className="mt-2 rounded-lg bg-amber-100 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          GPS ungenau (±{Math.round(accuracy)} m). Geh ins Freie, weg von hohen Gebäuden, und warte einen Moment.
        </p>
      )}
    </Card>
  )
}
