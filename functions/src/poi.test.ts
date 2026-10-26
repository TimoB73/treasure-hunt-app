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

  it('weicht bei Fehlern und Zeitüberschreitung auf den nächsten Server aus', async () => {
    const calls: string[] = []
    const fake = (async (url: string) => {
      calls.push(url)
      if (calls.length === 1) return new Response('busy', { status: 504 })
      if (calls.length === 2) throw Object.assign(new Error('timeout'), { name: 'TimeoutError' })
      return ok({ elements: [{ type: 'node', id: 1 }] })
    }) as unknown as typeof fetch
    const result = await fetchOverpass('q', fake)
    expect(result.elements).toHaveLength(1)
    expect(calls).toEqual(OVERPASS_ENDPOINTS.slice(0, 3))
  })

  it('wertet eine abgebrochene Abfrage mit Hinweis als Fehler', async () => {
    let n = 0
    const fake = (async () =>
      ++n === 1 ? ok({ elements: [], remark: 'runtime error: Query timed out' }) : ok({ elements: [] })) as unknown as typeof fetch
    await fetchOverpass('q', fake)
    expect(n).toBe(2)
  })

  it('meldet verständlich, wenn alle Server ausfallen', async () => {
    const fake = (async () => new Response('', { status: 503 })) as unknown as typeof fetch
    await expect(fetchOverpass('q', fake)).rejects.toThrow(/alle Server/)
  })
})
