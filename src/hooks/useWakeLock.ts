import { useEffect } from 'react'

/**
 * Hält den Bildschirm während der Jagd an. Der Browser gibt die Sperre beim Wechsel in den
 * Hintergrund automatisch frei, daher wird sie beim Zurückkehren neu angefordert.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) void sentinel.release()
        else lock = sentinel
      } catch {
        // z. B. Energiesparmodus – dann eben ohne
      }
    }

    void request()
    document.addEventListener('visibilitychange', request)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', request)
      void lock?.release()
    }
  }, [enabled])
}
