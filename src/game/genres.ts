/** Auswahl im Formular; die Schlüssel spiegeln functions/src/genres.ts */
export const GENRES = [
  { value: 'beliebig', label: 'Beliebig', emoji: '🎲' },
  { value: 'scifi', label: 'Science-Fiction', emoji: '🚀' },
  { value: 'fantasy', label: 'Fantasy', emoji: '🐉' },
  { value: 'krimi', label: 'Krimi', emoji: '🔍' },
  { value: 'dreifragezeichen', label: 'Die drei ???', emoji: '❓' },
  { value: 'action', label: 'Action', emoji: '💥' },
  { value: 'macgyver', label: 'MacGyver', emoji: '🔧' },
  { value: 'horror', label: 'Horror', emoji: '👻' },
  { value: 'piraten', label: 'Piraten', emoji: '🏴‍☠️' },
  { value: 'agenten', label: 'Agenten', emoji: '🕶️' },
  { value: 'zeitreise', label: 'Zeitreise', emoji: '⏳' },
  { value: 'maerchen', label: 'Märchen', emoji: '🧚' },
] as const

export type Genre = (typeof GENRES)[number]['value']

export function genreLabel(genre: Genre | undefined): string {
  const g = GENRES.find((x) => x.value === (genre ?? 'beliebig'))
  return g ? `${g.emoji} ${g.label}` : String(genre)
}
