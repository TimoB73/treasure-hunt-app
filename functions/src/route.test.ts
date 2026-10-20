import { describe, expect, it } from 'vitest'
import { distanceMeters } from './geo.js'
import { planBudget, seededRandom, selectRoute, startOffset } from './route.js'
import type { HuntParams, Poi } from './types.js'

const params: HuntParams = {
  start: { lat: 48.0, lng: 11.0 },
  durationMinutes: 60,
  difficulty: 'mittel',
  age: 12,
  mode: 'foot',
  stationCount: 5,
  groupCount: 2,
  staggerMinutes: 5,
  genre: 'beliebig',
}

/** Orte auf einem Raster um den Start; Weglänge = 1,3 × Luftlinie */
function grid(): { pois: Poi[]; matrix: number[][] } {
  const pois: Poi[] = []
  for (let x = -6; x <= 6; x++) {
    for (let y = -6; y <= 6; y++) {
      pois.push({
        osmId: `node/${x}_${y}`,
        position: { lat: 48 + y * 0.001, lng: 11 + x * 0.0015 },
        kind: (x + y) % 2 ? 'fountain' : 'artwork',
        kindLabel: 'Brunnen',
        name: null,
        tags: {},
        score: 3,
      })
    }
  }
  const points = [params.start, ...pois.map((p) => p.position)]
  const matrix = points.map((a) => points.map((b) => distanceMeters(a, b) * 1.3))
  return { pois, matrix }
}

describe('planBudget', () => {
  it('rechnet die Weglänge aus Dauer, Stationszeit und Tempo', () => {
    const b = planBudget(params)
    expect(b.stationMinutes).toBe(4)
    expect(b.targetMeters).toBe((60 - 5 * 4) * 70)
  })

  it('lehnt zu kurze Dauer ab', () => {
    expect(() => planBudget({ ...params, durationMinutes: 25, stationCount: 6 })).toThrow(/reichen nicht/)
  })

  it('plant mit dem Rad längere Wege und größere Abstände', () => {
    const foot = planBudget(params)
    const bike = planBudget({ ...params, mode: 'bike' })
    expect(bike.targetMeters).toBeGreaterThan(foot.targetMeters)
    expect(bike.minSpacing).toBeGreaterThan(foot.minSpacing)
  })
})

describe('selectRoute', () => {
  it('wählt passende Anzahl Stationen mit Mindestabstand und trifft die Ziellänge ungefähr', () => {
    const { pois, matrix } = grid()
    const budget = planBudget(params)
    const plan = selectRoute(params.start, pois, matrix, params, budget, seededRandom(1))
    expect(plan.loop).toHaveLength(4)
    expect(plan.loop).not.toContain(plan.goal)
    const all = [...plan.loop, plan.goal]
    for (const a of all) {
      for (const b of all) {
        if (a !== b) expect(matrix[a + 1][b + 1]).toBeGreaterThanOrEqual(budget.minSpacing * 0.6)
      }
    }
    expect(plan.groupMeters).toHaveLength(2)
    for (const m of plan.groupMeters) {
      expect(Math.abs(m - budget.targetMeters) / budget.targetMeters).toBeLessThan(0.35)
    }
    // Ziel nahe am Start
    expect(matrix[0][plan.goal + 1]).toBeLessThan(Math.max(250, budget.loopRadius * 0.5) + 1)
  })

  it('meldet zu wenige Orte verständlich', () => {
    const { pois, matrix } = grid()
    const few = pois.slice(0, 3)
    const small = matrix.slice(0, 4).map((r) => r.slice(0, 4))
    expect(() => selectRoute(params.start, few, small, params, planBudget(params), seededRandom(1))).toThrow(
      /nur 3 geeignete Orte/,
    )
  })

  it('ignoriert unerreichbare Orte', () => {
    const { pois, matrix } = grid()
    for (let i = 1; i < matrix.length; i += 2) matrix[0][i] = Infinity
    const plan = selectRoute(params.start, pois, matrix, params, planBudget(params), seededRandom(2))
    for (const c of [...plan.loop, plan.goal]) expect(Number.isFinite(matrix[0][c + 1])).toBe(true)
  })
})

describe('startOffset', () => {
  it('verteilt Gruppen gleichmäßig über den Rundkurs', () => {
    expect([0, 1, 2].map((g) => startOffset(g, 3, 6))).toEqual([0, 2, 4])
    expect([0, 1].map((g) => startOffset(g, 2, 4))).toEqual([0, 2])
  })
})
