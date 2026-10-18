import { describe, expect, it } from 'vitest'
import { checkAnswer, normalizeText, parseNumber, type AnswerSpec } from './answer'

describe('normalizeText', () => {
  it('vereinheitlicht Umlaute, Groß/Klein, Artikel und Satzzeichen', () => {
    expect(normalizeText('  Die SCHLÜSSEL! ')).toBe('schluessel')
    expect(normalizeText('Brücke')).toBe(normalizeText('bruecke'))
    expect(normalizeText('Café')).toBe('cafe')
  })
})

describe('parseNumber', () => {
  it('akzeptiert Komma und Leerzeichen', () => {
    expect(parseNumber(' 1 000 ')).toBe(1000)
    expect(parseNumber('3,5')).toBe(3.5)
    expect(parseNumber('sieben')).toBeNull()
  })
})

describe('checkAnswer', () => {
  it('prüft Zahlen', () => {
    expect(checkAnswer({ type: 'number', solution: 7 }, '7')).toBe(true)
    expect(checkAnswer({ type: 'number', solution: 7 }, '8')).toBe(false)
  })

  it('prüft Multiple Choice per Index', () => {
    expect(checkAnswer({ type: 'choice', options: ['a', 'b'], solution: 1 }, '1')).toBe(true)
    expect(checkAnswer({ type: 'choice', options: ['a', 'b'], solution: 1 }, '0')).toBe(false)
  })

  it('toleriert kleine Tippfehler im Freitext', () => {
    const spec: AnswerSpec = { type: 'text', solutions: ['Landkarte', 'Karte'] }
    expect(checkAnswer(spec, 'eine Karte')).toBe(true)
    expect(checkAnswer(spec, 'Landkrate')).toBe(true)
    expect(checkAnswer(spec, 'kerte')).toBe(true)
    expect(checkAnswer(spec, 'Kompass')).toBe(false)
    expect(checkAnswer(spec, '')).toBe(false)
  })
})
