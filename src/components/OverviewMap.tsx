import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { LatLng } from '../lib/geo'

const startIcon = L.divIcon({ html: '🚩', className: 'station-icon', iconSize: [32, 32], iconAnchor: [8, 30] })

const goalIcon = L.divIcon({ html: '🏁', className: 'station-icon', iconSize: [32, 32], iconAnchor: [8, 30] })

const numberIcon = (label: string, goal: boolean) =>
  L.divIcon({
    html: `<span class="number-icon${goal ? ' number-icon-goal' : ''}">${label}</span>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

interface Props {
  start: LatLng | null
  /** Selbst gewählter Zielpunkt (nur im Formular) */
  goal?: LatLng | null
  /** Stationen in Reihenfolge; die letzte ist das Ziel */
  stations?: LatLng[]
  onPick?: (point: LatLng) => void
  /** Bei Änderung wird der Ausschnitt neu auf Start und Stationen eingepasst */
  fitKey?: string | number
}

function PickHandler({ onPick }: { onPick: (point: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

function Fit({ points, fitKey }: { points: LatLng[]; fitKey?: string | number }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], Math.max(map.getZoom(), 15), { animate: false })
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [30, 30], animate: false })
    // Nur bei neuem fitKey, damit man die Karte sonst frei bewegen kann
  }, [map, fitKey])
  return null
}

/** Karte für den Spielleiter: Startpunkt wählen bzw. alle Stationen einer Jagd zeigen */
export function OverviewMap({ start, goal, stations = [], onPick, fitKey }: Props) {
  const points = [...(start ? [start] : []), ...(goal ? [goal] : []), ...stations]
  return (
    <MapContainer
      center={start ?? { lat: 51.16, lng: 10.45 }}
      zoom={start ? 15 : 6}
      maxZoom={19}
      className="h-full w-full rounded-xl"
      markerZoomAnimation={false}
      fadeAnimation={false}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      {start && <Marker position={start} icon={startIcon} />}
      {goal && <Marker position={goal} icon={goalIcon} />}
      {stations.map((s, i) => {
        const goal = i === stations.length - 1
        return <Marker key={i} position={s} icon={numberIcon(goal ? '🏁' : String(i + 1), goal)} />
      })}
      {onPick && <PickHandler onPick={onPick} />}
      <Fit points={points} fitKey={fitKey} />
    </MapContainer>
  )
}
