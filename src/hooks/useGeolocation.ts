import { useEffect, useState } from 'react'
import type { LatLng } from '../lib/geo'

export interface GeoState {
  position: LatLng | null
  /** Genauigkeit in Metern (Radius um die Position) */
  accuracy: number | null
  error: string | null
}

function errorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Standortzugriff verweigert. Bitte in den Browser-Einstellungen den Standort für diese Seite erlauben.'
    case err.POSITION_UNAVAILABLE:
      return 'Standort derzeit nicht verfügbar. Geh am besten ins Freie.'
    default:
      return 'Standort wird noch ermittelt …'
  }
}

/** Verfolgt die GPS-Position, solange enabled gesetzt ist */
export function useGeolocation(enabled: boolean): GeoState {
  const [state, setState] = useState<GeoState>({ position: null, accuracy: null, error: null })

  useEffect(() => {
    if (!enabled) return
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, error: 'Dieses Gerät unterstützt keine Standortbestimmung.' }))
      return
    }
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        setState({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
          error: null,
        }),
      (err) => setState((s) => ({ ...s, error: errorMessage(err) })),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled])

  return state
}
