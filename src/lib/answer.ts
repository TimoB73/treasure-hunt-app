export type AnswerSpec =
  | { type: 'number'; solution: number }
  | { type: 'choice'; options: string[]; solution: number }
  | { type: 'text'; solutions: string[] }

/** Vereinheitlicht Freitext: Groß/Klein, Umlaute, Akzente, Satzzeichen, Artikel */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(der|die|das|ein|eine|einen|den|dem)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/** Erlaubte Tippfehler: keine bei sehr kurzen Wörtern, einer bis 7 Zeichen, sonst zwei */
function allowedTypos(length: number): number {
  if (length <= 3) return 0
  return length <= 7 ? 1 : 2
}

export function parseNumber(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  return Number(cleaned)
}

/** Antwort prüfen; bei 'choice' ist input der Index der gewählten Option */
export function checkAnswer(spec: AnswerSpec, input: string): boolean {
  switch (spec.type) {
    case 'number':
      return parseNumber(input) === spec.solution
    case 'choice':
      return Number(input) === spec.solution
    case 'text': {
      const given = normalizeText(input)
      if (!given) return false
      return spec.solutions.some((s) => {
        const expected = normalizeText(s)
        return levenshtein(given, expected) <= allowedTypos(expected.length)
      })
    }
  }
}
