/** Genres der Geschichte; die Schlüssel spiegeln src/game/genres.ts im Frontend */
export const GENRES = {
  beliebig: 'freie Wahl – such dir ein Genre aus, das gut zu den Orten und dem Alter passt',
  scifi: 'Science-Fiction – Raumschiffe, Roboter, Außerirdische oder Zukunftstechnik',
  fantasy: 'Fantasy – Magie, Drachen, Zauberer, verwunschene Orte',
  krimi: 'Krimi – ein rätselhafter Fall, Spuren, Verdächtige; die Gruppe ermittelt als Detektivteam',
  action: 'Action – Verfolgungsjagd gegen die Zeit, Sabotage verhindern, mutige Rettung',
  macgyver:
    'MacGyver – mit Köpfchen und Alltagsgegenständen aus der Klemme improvisieren; Rätsel drehen sich um Tüfteln, Physik und clevere Lösungen (nur gedanklich – niemand baut oder zündet wirklich etwas)',
  horror: 'Horror – Grusel, Spuk und unheimliche Geräusche; immer mit gutem Ausgang',
  piraten: 'Piraten – Schatzkarten, Kapitäne, Flaschenpost und Seemannsgarn',
  agenten: 'Agenten – geheime Mission, Codes knacken, Decknamen und Tarnung',
  zeitreise: 'Zeitreise – ein Zeitportal ist kaputt; die Gruppe springt durch Epochen, um es zu reparieren',
  maerchen: 'Märchen – sprechende Tiere, gute Feen und ein Fluch, der gebrochen werden muss',
} as const

export type Genre = keyof typeof GENRES

export const GENRE_KEYS = Object.keys(GENRES) as [Genre, ...Genre[]]

/** Altersgerechte Einschränkung, z. B. für Horror mit kleinen Kindern */
export function genreHint(genre: Genre, age: number): string {
  if (genre === 'horror' && age < 12) return ' Für dieses Alter nur leichter, lustiger Grusel – nichts wirklich Beängstigendes.'
  if (genre === 'horror') return ' Spannend und unheimlich, aber ohne Blut, Gewalt oder verstörende Details.'
  if (genre === 'action' || genre === 'macgyver') return ' Die Spannung entsteht in der Geschichte – niemand soll draußen rennen, klettern oder etwas Gefährliches tun.'
  return ''
}
