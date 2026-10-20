import { describe, expect, it } from 'vitest'
import { genreHint } from './genres.js'
import { huntParamsSchema } from './types.js'

const base = {
  start: { lat: 48, lng: 11 },
  durationMinutes: 60,
  difficulty: 'mittel',
  age: 10,
  mode: 'foot',
  stationCount: 5,
  groupCount: 1,
  staggerMinutes: 0,
}

describe('Genre', () => {
  it('ist bei älteren App-Versionen ohne Genre „beliebig“', () => {
    expect(huntParamsSchema.parse(base).genre).toBe('beliebig')
  })

  it('lehnt unbekannte Genres ab', () => {
    expect(huntParamsSchema.safeParse({ ...base, genre: 'western' }).success).toBe(false)
    expect(huntParamsSchema.parse({ ...base, genre: 'macgyver' }).genre).toBe('macgyver')
    expect(huntParamsSchema.parse({ ...base, genre: 'dreifragezeichen' }).genre).toBe('dreifragezeichen')
  })

  it('macht Horror für Kinder harmlos', () => {
    expect(genreHint('horror', 8)).toMatch(/lustiger Grusel/)
    expect(genreHint('horror', 16)).toMatch(/ohne Blut/)
    expect(genreHint('krimi', 8)).toBe('')
  })
})
