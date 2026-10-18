import type { GeoState } from '../hooks/useGeolocation'

interface Props {
  canMarkReached: boolean
  radius: number
  geo: GeoState
  distance: number | null
  onMarkReached: () => void
  onRadiusChange: (radius: number) => void
  onReset: () => void
  onClose: () => void
}

const RADII = [10, 15, 20, 30, 50]

/** Nur im versteckten Testmodus sichtbar */
export function TestPanel({ canMarkReached, radius, geo, distance, onMarkReached, onRadiusChange, onReset, onClose }: Props) {
  return (
    <section className="rounded-2xl border-2 border-dashed border-fuchsia-500 bg-fuchsia-50 p-3 text-sm dark:bg-fuchsia-950/40">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-fuchsia-700 dark:text-fuchsia-300">🧪 Testmodus</strong>
        <button onClick={onClose} className="text-fuchsia-700 underline dark:text-fuchsia-300">
          ausblenden
        </button>
      </div>
      <button
        onClick={onMarkReached}
        disabled={!canMarkReached}
        className="w-full rounded-xl bg-fuchsia-600 px-4 py-3 font-semibold text-white active:bg-fuchsia-700 disabled:opacity-40"
      >
        Station als erreicht markieren
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          Geofence
          <select
            value={radius}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className="rounded border border-fuchsia-300 bg-transparent px-1 py-0.5"
          >
            {RADII.map((r) => (
              <option key={r} value={r}>
                {r} m
              </option>
            ))}
          </select>
        </label>
        <button onClick={onReset} className="ml-auto rounded border border-fuchsia-400 px-2 py-0.5">
          Jagd zurücksetzen
        </button>
      </div>
      <p className="mt-2 font-mono text-xs text-stone-600 dark:text-stone-400">
        {geo.position
          ? `${geo.position.lat.toFixed(6)}, ${geo.position.lng.toFixed(6)} · ±${Math.round(geo.accuracy ?? 0)} m`
          : 'keine Position'}
        {distance != null && ` · Ziel ${distance.toFixed(1)} m`}
      </p>
    </section>
  )
}
