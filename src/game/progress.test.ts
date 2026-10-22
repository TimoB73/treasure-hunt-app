import { describe, expect, it } from 'vitest'
import { demoHunt } from './demoHunt'
import { initialProgress, reduceProgress, type Action, type Progress } from './progress'

const run = (actions: Action[], from: Progress = initialProgress(demoHunt)) =>
  actions.reduce((s, a) => reduceProgress(demoHunt, s, a), from)

describe('reduceProgress', () => {
  it('durchläuft alle Stationen bis zum Finale', () => {
    const perStation: Action[] = [
      { type: 'arrive' },
      { type: 'openRiddle' },
      { type: 'solve', now: 2 },
      { type: 'continue', now: 3 },
    ]
    const s = run([{ type: 'start', now: 1 }, ...perStation, ...perStation, ...perStation])
    expect(s.phase).toBe('finished')
    expect(s.index).toBe(2)
    expect(s.startedAt).toBe(1)
    expect(s.finishedAt).toBe(3)
  })

  it('schaltet die nächste Station erst nach gelöstem Rätsel frei', () => {
    const s = run([{ type: 'start', now: 1 }, { type: 'arrive' }, { type: 'solve', now: 2 }])
    expect(s.phase).toBe('chapter')
    expect(s.index).toBe(0)
  })

  it('zeigt nach dem Lösen erst die Überleitung und gibt die nächste Station erst nach „Weiter“ frei', () => {
    const solved = run([{ type: 'start', now: 1 }, { type: 'arrive' }, { type: 'openRiddle' }, { type: 'solve', now: 2 }])
    expect(solved.phase).toBe('solved')
    expect(solved.index).toBe(0)
    // Ankunft an einer anderen Station darf die Überleitung nicht überspringen
    expect(run([{ type: 'arrive' }], solved).phase).toBe('solved')
    const next = run([{ type: 'continue', now: 3 }], solved)
    expect(next.phase).toBe('travel')
    expect(next.index).toBe(1)
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
