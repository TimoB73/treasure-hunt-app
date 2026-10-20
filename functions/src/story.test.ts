import { describe, expect, it } from 'vitest'
import { validateStory, type StationFacts, type StoryOutput } from './story.js'

const facts: StationFacts[] = [
  { stationNumber: 1, isGoal: false, kind: 'Brunnen', name: 'Marktbrunnen', osm: { name: 'Marktbrunnen', start_date: '1873' }, wikipedia: null },
  { stationNumber: 2, isGoal: true, kind: 'Park', name: 'Stadtpark', osm: { name: 'Stadtpark' }, wikipedia: 'Der Stadtpark wurde 1910 von Gärtner Huber angelegt.' },
]

type Riddle = StoryOutput['stations'][number]['riddle']
const riddle = (r: Partial<Riddle>): Riddle => ({
  question: 'Frage?',
  answerType: 'number',
  numberSolution: 7,
  options: [],
  choiceSolution: null,
  textSolutions: [],
  hints: ['Tipp 1', 'Tipp 2'],
  factSource: 'none',
  factQuote: null,
  ...r,
})

const story = (r1: Partial<Riddle>, r2: Partial<Riddle> = {}): StoryOutput => ({
  title: 'Titel',
  intro: 'Intro',
  outro: 'Outro',
  stations: [
    { stationNumber: 1, chapter: 'Kapitel 1', riddle: riddle(r1) },
    { stationNumber: 2, chapter: 'Kapitel 2', riddle: riddle(r2) },
  ],
})

describe('validateStory', () => {
  it('akzeptiert eine gültige Ausgabe', () => {
    expect(validateStory(story({}), facts)).toEqual([])
  })

  it('verlangt jede Station genau einmal', () => {
    const s = story({})
    s.stations[1].stationNumber = 1
    expect(validateStory(s, facts)[0]).toMatch(/genau die Stationen 1, 2/)
  })

  it('verlangt genau zwei Tipps', () => {
    expect(validateStory(story({ hints: ['nur einer'] }), facts)[0]).toMatch(/zwei/)
  })

  it('prüft Multiple Choice', () => {
    expect(validateStory(story({ answerType: 'choice', options: ['a', 'b', 'c'], choiceSolution: 1 }), facts)).toEqual([])
    expect(validateStory(story({ answerType: 'choice', options: ['a', 'A', 'c'], choiceSolution: 1 }), facts)).toHaveLength(1)
    expect(validateStory(story({ answerType: 'choice', options: ['a', 'b', 'c'], choiceSolution: 3 }), facts)).toHaveLength(1)
  })

  it('akzeptiert belegte Fakten aus OSM und Wikipedia', () => {
    const s = story(
      { numberSolution: 1873, factSource: 'osm', factQuote: '1873' },
      { answerType: 'text', numberSolution: null, textSolutions: ['Huber'], factSource: 'wikipedia', factQuote: 'von Gärtner Huber angelegt' },
    )
    expect(validateStory(s, facts)).toEqual([])
  })

  it('lehnt erfundene Fakten ab', () => {
    // Zitat steht nicht in den Fakten
    expect(validateStory(story({ numberSolution: 1875, factSource: 'osm', factQuote: 'erbaut 1875' }), facts)[0]).toMatch(/wörtliches Zitat/)
    // Zitat stimmt, aber die Lösung steht nicht darin
    expect(validateStory(story({ numberSolution: 1875, factSource: 'osm', factQuote: '1873' }), facts)[0]).toMatch(/nicht belegt/)
    // Wikipedia-Zitat bei einer Station ohne Wikipedia
    expect(validateStory(story({ factSource: 'wikipedia', factQuote: 'Der Stadtpark' }), facts)[0]).toMatch(/wörtliches Zitat/)
  })
})
