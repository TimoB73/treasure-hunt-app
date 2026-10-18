import { describe, expect, it } from 'vitest'
import { bearingDegrees, directionName, distanceMeters, formatDistance } from './geo'

describe('distanceMeters', () => {
  it('misst kurze Strecken auf wenige Meter genau', () => {
    // 0,001° Breite ≈ 111 m
    expect(distanceMeters({ lat: 36.725, lng: -4.139 }, { lat: 36.726, lng: -4.139 })).toBeCloseTo(111.2, 0)
  })

  it('ist für denselben Punkt 0', () => {
    expect(distanceMeters({ lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBe(0)
  })
})

describe('bearingDegrees', () => {
  it('erkennt die Himmelsrichtungen', () => {
    const o = { lat: 36.725, lng: -4.139 }
    expect(directionName(bearingDegrees(o, { lat: 36.726, lng: -4.139 }))).toBe('Norden')
    expect(directionName(bearingDegrees(o, { lat: 36.725, lng: -4.138 }))).toBe('Osten')
    expect(directionName(bearingDegrees(o, { lat: 36.724, lng: -4.139 }))).toBe('Süden')
    expect(directionName(bearingDegrees(o, { lat: 36.725, lng: -4.14 }))).toBe('Westen')
  })
})

describe('formatDistance', () => {
  it('formatiert Meter und Kilometer', () => {
    expect(formatDistance(42.4)).toBe('42 m')
    expect(formatDistance(1530)).toBe('1,5 km')
  })
})
