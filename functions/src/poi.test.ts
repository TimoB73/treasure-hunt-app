import { describe, expect, it } from 'vitest'
import { OVERPASS_ENDPOINTS, buildOverpassQuery, extractPois, fetchOverpass, thinOut, type OverpassResult } from './poi.js'

const road = {
  type: 'way' as const,
  id: 1,
  tags: { highway: 'primary' },
  geometry: [
    { lat: 48.0, lon: 11.0 },
    { lat: 48.0, lon: 11.01 },
  ],
}

describe('buildOverpassQuery', () => {
  it('fragt Orte und Hauptstraßen im Umkreis ab', () => {
    const q = buildOverpassQuery({ lat: 48, lng: 11 }, 800)
    expect(q).toContain('(around:800,48.000000,11.000000)[amenity=fountain]')
    expect(q).toContain('highway~')
  })
})

describe('extractPois', () => {
  const result: OverpassResult = {
    elements: [
      road,
      { type: 'node', id: 2, lat: 48.0001, lon: 11.005, tags: { amenity: 'fountain', name: 'Straßenbrunnen' } },
      { type: 'node', id: 3, lat: 48.002, lon: 11.005, tags: { amenity: 'fountain', name: 'Marktbrunnen', wikipedia: 'de:Marktbrunnen', fixme: 'x' } },
      { type: 'node', id: 4, lat: 48.003, lon: 11.005, tags: { leisure: 'playground', access: 'private' } },
      { type: 'node', id: 5, lat: 48.004, lon: 11.005, tags: { historic: 'memorial', memorial: 'stolperstein' } },
      {
        type: 'way',
        id: 6,
        center: { lat: 48.005, lon: 11.005 },
        bounds: { minlat: 48.0, minlon: 11.0, maxlat: 48.01, maxlon: 11.01 },
        tags: { leisure: 'park', name: 'Großer Park' },
      },
      { type: 'node', id: 7, lat: 48.003, lon: 11.006, tags: { leisure: 'playground' } },
    ],
  }

  it('entfernt Orte an Hauptstraßen, private Orte, Stolpersteine und große Flächen', () => {
    const ids = extractPois(result, { age: 8 }).map((p) => p.osmId)
    expect(ids).toEqual(['node/3', 'node/7'])
  })

  it('bewertet Wikipedia und Spielplätze für Kinder höher und behält nur Fakten-Tags', () => {
    const [market, playground] = extractPois(result, { age: 8 })
    expect(market.score).toBeGreaterThan(3)
    expect(market.tags).toEqual({ name: 'Marktbrunnen', wikipedia: 'de:Marktbrunnen' })
    expect(playground.score).toBe(4)
    expect(extractPois(result, { age: 30 })[1].score).toBe(1)
  })
})

describe('thinOut', () => {
  it('behält bei dicht beieinanderliegenden Orten den besseren', () => {
    const base = { kind: 'x', kindLabel: 'X', name: null, tags: {} }
    const kept = thinOut(
      [
        { ...base, osmId: 'a', position: { lat: 48, lng: 11 }, score: 1 },
        { ...base, osmId: 'b', position: { lat: 48.0001, lng: 11 }, score: 2 },
        { ...base, osmId: 'c', position: { lat: 48.01, lng: 11 }, score: 1 },
      ],
      40,
      10,
    )
    expect(kept.map((p) => p.osmId)).toEqual(['b', 'c'])
  })
})

describe('fetchOverpass', () => {
  const ok = (body: object) => new Response(JSON.stringify(body), { status: 200 })
  const fast = { staggerMs: 0, timeoutMs: 200, retryDelayMs: 0 }

  it('nimmt die erste brauchbare Antwort, auch wenn der Hauptserver ausfällt', async () => {
    const fake = (async (url: string) => {
      if (url.includes('overpass-api.de')) return new Response('bad gateway', { status: 502 })
      if (url.includes('private.coffee')) return ok({ elements: [{ type: 'node', id: 2 }] })
      return new Promise<Response>(() => undefined) // hängt
    }) as unknown as typeof fetch
    let fellBack = false
    const result = await fetchOverpass('q', { ...fast, fetchImpl: fake, onFallback: () => (fellBack = true) })
    expect(result.elements[0].id).toBe(2)
    expect(fellBack).toBe(true)
  })

  it('schaltet beim Ausfall sofort den nächsten Server zu, ohne den Takt abzuwarten', async () => {
    const calls: string[] = []
    const fake = (async (url: string) => {
      calls.push(url)
      return calls.length === 1 ? new Response('', { status: 502 }) : ok({ elements: [] })
    }) as unknown as typeof fetch
    const started = Date.now()
    await fetchOverpass('q', { ...fast, staggerMs: 10_000, fetchImpl: fake })
    expect(Date.now() - started).toBeLessThan(1000)
    expect(calls).toEqual(OVERPASS_ENDPOINTS.slice(0, 2))
  })

  it('wertet eine abgebrochene Abfrage mit Hinweis als Fehler', async () => {
    const fake = (async (url: string) =>
      url.includes('overpass-api.de')
        ? ok({ elements: [], remark: 'runtime error: Query timed out' })
        : ok({ elements: [{ type: 'node', id: 3 }] })) as unknown as typeof fetch
    const result = await fetchOverpass('q', { ...fast, fetchImpl: fake })
    expect(result.elements).toHaveLength(1)
  })

  it('versucht es ein zweites Mal, bevor es aufgibt', async () => {
    let n = 0
    const fake = (async () => (++n <= OVERPASS_ENDPOINTS.length ? new Response('', { status: 503 }) : ok({ elements: [] }))) as unknown as typeof fetch
    await fetchOverpass('q', { ...fast, fetchImpl: fake })
    expect(n).toBe(OVERPASS_ENDPOINTS.length + 1)
  })

  it('meldet verständlich, wenn alle Server zweimal ausfallen', async () => {
    const fake = (async () => new Response('', { status: 503 })) as unknown as typeof fetch
    await expect(fetchOverpass('q', { ...fast, fetchImpl: fake })).rejects.toThrow(/zwei Durchgängen/)
  })
})
