import { useCallback, useEffect, useRef, useState } from 'react'

const KEY = 'schatzsuche.testmode'
const TAPS_NEEDED = 5
const TAP_WINDOW_MS = 2500

function initialValue(): boolean {
  const param = new URLSearchParams(window.location.search).get('test')
  try {
    if (param === '1') localStorage.setItem(KEY, '1')
    if (param === '0') localStorage.removeItem(KEY)
    return localStorage.getItem(KEY) === '1'
  } catch {
    return param === '1'
  }
}

/**
 * Versteckter Testmodus: an über ?test=1 bzw. aus über ?test=0
 * oder durch fünfmaliges schnelles Tippen auf den Titel.
 */
export function useTestMode() {
  const [enabled, setEnabled] = useState(initialValue)
  const taps = useRef<number[]>([])

  useEffect(() => {
    try {
      if (enabled) localStorage.setItem(KEY, '1')
      else localStorage.removeItem(KEY)
    } catch {
      // ohne Speicher gilt der Testmodus nur bis zum Neuladen
    }
  }, [enabled])

  const registerTap = useCallback(() => {
    const now = Date.now()
    taps.current = [...taps.current.filter((t) => now - t < TAP_WINDOW_MS), now]
    if (taps.current.length >= TAPS_NEEDED) {
      taps.current = []
      setEnabled((e) => !e)
    }
  }, [])

  return { enabled, setEnabled, registerTap }
}

export type TestMode = ReturnType<typeof useTestMode>
