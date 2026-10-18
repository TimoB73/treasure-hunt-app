import { useEffect } from 'react'
import L from 'leaflet'
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import type { LatLng } from '../lib/geo'
import type { Station } from '../game/types'

const icon = (emoji: string) =>
  L.divIcon({ html: emoji, className: 'station-icon', iconSize: [32, 32], iconAnchor: [16, 30] })

const targetIcon = icon('📍')
const doneIcon = icon('✅')

interface Props {
  target: Station | null
  done: Station[]
  player: LatLng | null
  accuracy: number | null
  radius: number
  recenterKey: number
}

/** Zeigt beim Wechsel des Ziels (oder auf Wunsch) Spieler und Ziel gemeinsam */
function FitView({ target, player, recenterKey }: Pick<Props, 'target' | 'player' | 'recenterKey'>) {
  const map = useMap()
  const hasPlayer = player !== null
  useEffect(() => {
    const points = [target?.position, player].filter((p): p is LatLng => p != null)
    if (points.length === 0) return
    if (points.length === 1) map.setView(points[0], 18, { animate: false })
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 19, animate: false })
    // Absichtlich nicht bei jeder Positionsänderung, damit man die Karte frei verschieben kann
  }, [map, target?.id, hasPlayer, recenterKey])
  return null
}

/** Nach Rückkehr aus dem Hintergrund oder Größenänderung die Karte neu vermessen und zeichnen */
function KeepAlive() {
  const map = useMap()
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') map.invalidateSize({ pan: false })
    }
    const observer = new ResizeObserver(refresh)
    observer.observe(map.getContainer())
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [map])
  return null
}

export function HuntMap({ target, done, player, accuracy, radius, recenterKey }: Props) {
  const center = target?.position ?? player ?? done[done.length - 1]?.position ?? { lat: 0, lng: 0 }
  return (
    <MapContainer
      center={center}
      zoom={18}
      maxZoom={19}
      className="h-full w-full"
      zoomControl={false}
      // Marker-Animationen beim Zoomen abschalten: entfernt man währenddessen einen Marker, bricht Leaflet ab
      markerZoomAnimation={false}
      fadeAnimation={false}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      {done.map((s) => (
        <Marker key={s.id} position={s.position} icon={doneIcon} />
      ))}
      {target && (
        <>
          <Circle center={target.position} radius={radius} pathOptions={{ color: '#d97706', weight: 2, fillOpacity: 0.15 }} />
          <Marker position={target.position} icon={targetIcon} />
        </>
      )}
      {player && (
        <>
          {accuracy != null && (
            <Circle center={player} radius={accuracy} pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.1 }} />
          )}
          <CircleMarker
            center={player}
            radius={8}
            pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}
          />
        </>
      )}
      <FitView target={target} player={player} recenterKey={recenterKey} />
      <KeepAlive />
    </MapContainer>
  )
}
