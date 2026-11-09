import { describe, expect, it } from 'vitest'
import { searchPlaces } from './geocode'

describe('searchPlaces', () => {
  it('wandelt Treffer in Ort und Koordinaten um', async () => {
    let calledUrl = ''
    const fake = (async (url: string) => {
      calledUrl = url
      return new Response(JSON.stringify([{ display_name: 'Stadtpark, Hamburg', lat: '53.59', lon: '10.02' }]))
    }) as unknown as typeof fetch
    const places = await searchPlaces('Stadtpark Hamburg', fake)
    expect(places).toEqual([{ label: 'Stadtpark, Hamburg', position: { lat: 53.59, lng: 10.02 } }])
    expect(calledUrl).toContain('q=Stadtpark+Hamburg')
    expect(calledUrl).toContain('accept-language=de')
  })

  it('sucht erst ab drei Zeichen', async () => {
    const fake = (async () => {
      throw new Error('sollte nicht aufgerufen werden')
    }) as unknown as typeof fetch
    expect(await searchPlaces('ab', fake)).toEqual([])
  })
})
