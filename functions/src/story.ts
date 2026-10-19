import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { UserFacingError, anthropicError } from './errors.js'
import type { AnswerSpec, HuntParams, Riddle } from './types.js'

const MODEL = 'claude-opus-5-5'

/** Was das Modell über eine Station erfährt – nur belegte Daten aus OSM und Wikipedia */
export interface StationFacts {
  stationNumber: number
  isGoal: boolean
  kind: string
  name: string | null
  osm: Record<string, string>
  wikipedia: string | null
}

const riddleSchema = z.object({
  question: z.string(),
  answerType: z.enum(['number', 'choice', 'text']),
  numberSolution: z.number().nullable(),
  options: z.array(z.string()),
  choiceSolution: z.number().int().nullable(),
  textSolutions: z.array(z.string()),
  hints: z.array(z.string()),
  factSource: z.enum(['none', 'osm', 'wikipedia']),
  factQuote: z.string().nullable(),
})

export const storySchema = z.object({
  title: z.string(),
  intro: z.string(),
  outro: z.string(),
  stations: z.array(
    z.object({
      stationNumber: z.number().int(),
      chapter: z.string(),
      riddle: riddleSchema,
    }),
  ),
})

export type StoryOutput = z.infer<typeof storySchema>

export interface Story {
  title: string
  intro: string
  outro: string
  /** In derselben Reihenfolge wie die übergebenen Stationen */
  stations: { chapter: string; riddle: Riddle }[]
}

const DIFFICULTY: Record<HuntParams['difficulty'], string> = {
  leicht: 'leicht – Rätsel in einem Schritt lösbar, Rechenaufgaben im kleinen Einmaleins',
  mittel: 'mittel – Rätsel mit ein bis zwei Denkschritten',
  schwer: 'schwer – knifflige Rätsel mit mehreren Denkschritten, aber eindeutiger Lösung',
}

const SYSTEM_PROMPT = `Du schreibst Schatzsuchen, die Gruppen draußen mit dem Handy an echten Orten spielen. Die App zeigt die Koordinaten der Stationen; an jeder Station erscheint dein Kapitel, danach dein Rätsel. Wer das Rätsel löst, bekommt die nächste Station freigeschaltet.

Regeln – sie sind wichtiger als eine schöne Geschichte:

1. Keine erfundenen Ortsfakten. Über einen Ort darfst du nur behaupten, was in seinen FAKTEN steht (OSM-Tags oder Wikipedia-Auszug). Ansonsten beschreibst du ihn nur allgemein über seine Art („ein Brunnen“, „ein Spielplatz“) und über die erfundene Geschichte. Keine Aussagen über Aussehen, Farben, Anzahl von Dingen, Inschriften oder Jahreszahlen, die nicht in den Fakten stehen.

2. Jedes Rätsel ist entweder
   a) ortsunabhängig (Logik, Wortspiel, Rechnen, altersgerechtes Allgemeinwissen): factSource "none", factQuote null; oder
   b) faktenbasiert: factSource "osm" oder "wikipedia", und factQuote ist ein wörtliches Zitat aus den Fakten genau dieser Station, das die richtige Antwort enthält. Fakten aus Wikipedia sind vor Ort nicht sichtbar – erzähle sie deshalb im Kapitel derselben Station, sodass das Rätsel damit lösbar ist. Eine Inschrift (OSM-Tag inscription) kann man vor Ort lesen.
   Mische beide Arten, wenn Fakten vorhanden sind; ohne Fakten nur Art a).

3. Antworttypen – bevorzugt "number" oder "choice":
   - number: numberSolution ist eine ganze Zahl; options [], choiceSolution null, textSolutions [].
   - choice: 3 oder 4 kurze, verschiedene Optionen, genau eine richtig; choiceSolution ist ihr Index ab 0; numberSolution null, textSolutions [].
   - text: nur wenn die Lösung ein einzelnes eindeutiges Wort (höchstens zwei) ist; textSolutions enthält alle gängigen Schreibweisen und Synonyme; numberSolution null, options [], choiceSolution null.
   Die Frage muss genau eine richtige Antwort haben.

4. Genau zwei Tipps pro Rätsel: der erste gibt eine Denkrichtung, der zweite führt fast zur Lösung.

5. Mehrere Gruppen besuchen die Stationen außer dem Ziel in unterschiedlicher, rotierter Reihenfolge. Die Kapitel dieser Stationen müssen deshalb in jeder Reihenfolge funktionieren: keine Wörter wie „erste“, „zweite“, „nächste“, „letzte“ oder „vorige“ Station, keine Bezüge auf andere Kapitel. Jedes Kapitel enthüllt ein eigenständiges Puzzleteil der Geschichte. Die Station mit isGoal true ist für alle das gemeinsame Finale; ihr Kapitel führt die Puzzleteile zusammen.

6. Sicherheit und Respekt: Fordere nie dazu auf, irgendwo hinaufzuklettern, ins Wasser zu gehen, Straßen zu betreten, etwas zu verändern, zu beschädigen oder mitzunehmen. Kirchen, Denkmäler und Gedenkorte werden respektvoll behandelt; dort keine albernen oder makabren Rätsel und keine Aufforderung, Gebäude zu betreten.

7. Sprache: Deutsch, lebendig und altersgerecht. Längen: intro 80–150 Wörter (verrät noch keinen Ort), jedes chapter 40–90 Wörter, outro 80–150 Wörter, Fragen und Tipps je ein bis zwei Sätze. title höchstens 50 Zeichen.

Antworte ausschließlich im vorgegebenen JSON-Format, mit genau einem Eintrag pro Station.`

function buildUserPrompt(params: HuntParams, stations: StationFacts[]): string {
  const players =
    params.groupCount > 1 ? `${params.groupCount} Gruppen, die gegeneinander spielen` : 'eine Gruppe'
  return `Schreibe eine Schatzsuche mit diesen Eckdaten:
- Alter des jüngsten Mitspielers: ${params.age} Jahre
- Schwierigkeit: ${DIFFICULTY[params.difficulty]}
- Dauer insgesamt: etwa ${params.durationMinutes} Minuten, ${params.mode === 'bike' ? 'mit dem Fahrrad' : 'zu Fuß'}
- Spieler: ${players}

Stationen (stationNumber, Art, Name und FAKTEN):
${JSON.stringify(stations, null, 2)}`
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** Zahl so schreiben, wie sie in deutschem oder englischem Text stehen kann */
const numberSpellings = (n: number) => [String(n), String(n).replace('.', ',')]

/** Prüft die Modellausgabe auf alles, was das JSON-Schema nicht ausdrücken kann */
export function validateStory(story: StoryOutput, stations: StationFacts[]): string[] {
  const errors: string[] = []
  const expected = stations.map((s) => s.stationNumber).sort((a, b) => a - b)
  const got = story.stations.map((s) => s.stationNumber).sort((a, b) => a - b)
  if (JSON.stringify(expected) !== JSON.stringify(got)) {
    errors.push(`stations muss genau die Stationen ${expected.join(', ')} enthalten (erhalten: ${got.join(', ')}).`)
  }
  if (!story.title.trim() || !story.intro.trim() || !story.outro.trim()) errors.push('title, intro und outro dürfen nicht leer sein.')

  for (const entry of story.stations) {
    const label = `Station ${entry.stationNumber}`
    const facts = stations.find((s) => s.stationNumber === entry.stationNumber)
    const r = entry.riddle
    if (!entry.chapter.trim()) errors.push(`${label}: chapter ist leer.`)
    if (!r.question.trim()) errors.push(`${label}: question ist leer.`)
    if (r.hints.length !== 2 || r.hints.some((h) => !h.trim())) errors.push(`${label}: genau zwei nicht leere Tipps nötig.`)

    let answerText: string[] = []
    switch (r.answerType) {
      case 'number':
        if (r.numberSolution == null || !Number.isFinite(r.numberSolution)) errors.push(`${label}: numberSolution fehlt.`)
        else answerText = numberSpellings(r.numberSolution)
        break
      case 'choice': {
        const distinct = new Set(r.options.map(normalize))
        if (r.options.length < 3 || r.options.length > 4 || distinct.size !== r.options.length || r.options.some((o) => !o.trim())) {
          errors.push(`${label}: choice braucht 3 oder 4 verschiedene, nicht leere Optionen.`)
        }
        if (r.choiceSolution == null || r.choiceSolution < 0 || r.choiceSolution >= r.options.length) {
          errors.push(`${label}: choiceSolution muss ein gültiger Index in options sein.`)
        } else answerText = [r.options[r.choiceSolution]]
        break
      }
      case 'text':
        if (r.textSolutions.length === 0 || r.textSolutions.some((t) => !t.trim() || t.length > 40)) {
          errors.push(`${label}: textSolutions braucht mindestens eine kurze Lösung (höchstens 40 Zeichen).`)
        }
        answerText = r.textSolutions
        break
    }

    if (r.factSource !== 'none') {
      const source = r.factSource === 'osm' ? Object.values(facts?.osm ?? {}).join('\n') : (facts?.wikipedia ?? '')
      const quote = r.factQuote ? normalize(r.factQuote) : ''
      if (!quote || !normalize(source).includes(quote)) {
        errors.push(`${label}: factQuote muss ein wörtliches Zitat aus den ${r.factSource}-Fakten dieser Station sein.`)
      } else if (answerText.length && !answerText.some((a) => quote.includes(normalize(a)))) {
        errors.push(`${label}: Die Lösung muss im factQuote vorkommen – sonst ist sie nicht belegt.`)
      }
    }
  }
  return errors
}

function toRiddle(r: StoryOutput['stations'][number]['riddle']): Riddle {
  let answer: AnswerSpec
  switch (r.answerType) {
    case 'number':
      answer = { type: 'number', solution: r.numberSolution! }
      break
    case 'choice':
      answer = { type: 'choice', options: r.options.map((o) => o.trim()), solution: r.choiceSolution! }
      break
    case 'text':
      answer = { type: 'text', solutions: r.textSolutions.map((t) => t.trim()) }
      break
  }
  return { question: r.question.trim(), answer, hints: [r.hints[0].trim(), r.hints[1].trim()] }
}

/**
 * Lässt Claude Story, Kapitel und Rätsel schreiben.
 * Ist die Antwort ungültig, wird einmal mit den gefundenen Fehlern nachgefragt.
 */
export async function generateStory(params: HuntParams, stations: StationFacts[], apiKey: string): Promise<Story> {
  const client = new Anthropic({ apiKey, maxRetries: 2 })
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: buildUserPrompt(params, stations) }]

  for (let attempt = 1; attempt <= 2; attempt++) {
    let problems: string[]
    let content: Anthropic.Beta.BetaContentBlock[] = []
    try {
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        // Lehnt das Modell aus Richtliniengründen ab, versucht die API es serverseitig mit einem Ersatzmodell
        fallbacks: 'default',
        system: SYSTEM_PROMPT,
        output_config: { effort: 'medium', format: betaZodOutputFormat(storySchema) },
        messages,
      })
      const response = await stream.finalMessage()
      content = response.content
      if (response.stop_reason === 'refusal') {
        throw new UserFacingError(
          'failed-precondition',
          'story_refused',
          'Claude hat es abgelehnt, zu diesen Orten eine Geschichte zu schreiben.',
          'Einen anderen Startpunkt wählen und erneut versuchen.',
        )
      }
      const story = response.parsed_output
      problems =
        response.stop_reason === 'max_tokens'
          ? ['Die Antwort wurde abgeschnitten – fasse dich kürzer.']
          : story
            ? validateStory(story, stations)
            : ['Die Antwort entsprach nicht dem JSON-Schema.']
      if (story && problems.length === 0) {
        const byNumber = new Map(story.stations.map((s) => [s.stationNumber, s]))
        return {
          title: story.title.trim(),
          intro: story.intro.trim(),
          outro: story.outro.trim(),
          stations: stations.map((s) => {
            const entry = byNumber.get(s.stationNumber)!
            return { chapter: entry.chapter.trim(), riddle: toRiddle(entry.riddle) }
          }),
        }
      }
    } catch (error) {
      if (error instanceof UserFacingError) throw error
      if (error instanceof Anthropic.APIError) throw anthropicError(error)
      // Sonstige Fehler (z. B. JSON nicht lesbar) wie ungültige Ausgabe behandeln
      problems = [`Die Antwort war kein gültiges JSON (${String(error).slice(0, 200)}).`]
    }

    console.warn(`Story-Versuch ${attempt} ungültig:`, problems)
    if (content.length) messages.push({ role: 'assistant', content })
    messages.push({
      role: 'user',
      content: `Deine Antwort hat diese Fehler:\n- ${problems.join('\n- ')}\nBitte gib die vollständige Schatzsuche korrigiert erneut aus.`,
    })
  }

  throw new UserFacingError(
    'internal',
    'story_invalid',
    'Claude hat zweimal keine gültige Schatzsuche geliefert.',
    'Einfach noch einmal auf „Jagd erzeugen“ tippen – meist klappt es beim nächsten Versuch.',
  )
}
