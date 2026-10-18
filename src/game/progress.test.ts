import { describe, expect, it } from 'vitest'
import { demoHunt } from './demoHunt'
import { initialProgress, reduceProgress, type Action, type Progress } from './progress'

const run = (actions: Action[], from: Progress = initialProgress(demoHunt)) =>
  actions.reduce((s, a) => reduceProgress(demoHunt, s, a), from)

describe('reduceProgress', () => {
  it('durchläuft alle Stationen bis zum Finale', () => {
    const perStation: Action[] = [{ type: 'arrive' }, { type: 'openRiddle' }, { type: 'solve', now: 2 }]
    const s = run([{ type: 'start', now: 1 }, ...perStation, ...perStation, ...perStation])
    expect(s.phase).toBe('finished')
    expect(s.index).toBe(2)
    expect(s.startedAt).toBe(1)
    expect(s.finishedAt).toBe(2)
  })

  it('schaltet die nächste Station erst nach gelöstem Rätsel frei', () => {
    const s = run([{ type: 'start', now: 1 }, { type: 'arrive' }, { type: 'solve', now: 2 }])
    expect(s.phase).toBe('chapter')
    expect(s.index).toBe(0)
  })

  it('ignoriert Ankunft außerhalb der Reisephase', () => {
    expect(run([{ type: 'arrive' }]).phase).toBe('intro')
  })

  it('erlaubt höchstens zwei Tipps pro Station', () => {
    const s = run([
      { type: 'start', now: 1 },
      { type: 'arrive' },
      { type: 'openRiddle' },
      { type: 'revealHint' },
      { type: 'revealHint' },
      { type: 'revealHint' },
    ])
    expect(s.hintsUsed).toEqual([2, 0, 0])
  })

  it('setzt mit reset alles zurück', () => {
    const s = run([{ type: 'start', now: 1 }, { type: 'arrive' }, { type: 'reset' }])
    expect(s).toEqual(initialProgress(demoHunt))
  })
})
