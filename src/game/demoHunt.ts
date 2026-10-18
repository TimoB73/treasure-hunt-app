import type { Hunt } from './types'

/**
 * Fest codierte Test-Jagd für den Prototyp (Phase 2).
 * Rätsel sind bewusst ortsunabhängig – keine Fakten über die Orte selbst.
 * Die Stationen liegen nur 20–45 m auseinander, daher ein kleinerer Geofence als die üblichen 30 m.
 */
export const demoHunt: Hunt = {
  id: 'demo-1',
  title: 'Das Vermächtnis der Kapitänin Mara',
  radius: 15,
  intro:
    'Vor langer Zeit versteckte die Kapitänin Mara ihren wertvollsten Schatz. Sie hinterließ eine Spur aus drei Wegmarken – an jeder wartet ein Rätsel, das euch den Weg zur nächsten verrät. Die erste Wegmarke ist bereits auf eurer Karte eingezeichnet. Macht euch auf den Weg!',
  outro:
    'Ihr habt alle Rätsel der Kapitänin gelöst! Unter eurem letzten Hinweis liegt Maras Vermächtnis: keine Goldmünzen, sondern ihr Logbuch – mit der Einladung, selbst eine Schatzsuche für andere zu verstecken. Glückwunsch, ihr seid würdige Nachfolger!',
  stations: [
    {
      id: 's1',
      name: 'Erste Wegmarke',
      position: { lat: 36.72554555039448, lng: -4.139022709729369 },
      chapter:
        'Ihr habt die erste Wegmarke gefunden! In Maras Logbuch steht: „Wer meinen Schatz will, muss rechnen können wie ein Steuermann.“ Darunter ein Zahlenrätsel.',
      riddle: {
        question:
          'Ich bin eine Zahl. Nimm mich mal 3 und zieh dann 4 ab – heraus kommt 17. Welche Zahl bin ich?',
        answer: { type: 'number', solution: 7 },
        hints: ['Rechne rückwärts: Was ist 17 + 4?', '21 geteilt durch 3 …'],
      },
    },
    {
      id: 's2',
      name: 'Zweite Wegmarke',
      position: { lat: 36.72516796713361, lng: -4.1392359542686865 },
      chapter:
        'Die zweite Wegmarke! Mara schreibt: „Ein guter Seefahrer denkt um die Ecke.“ Neben der Notiz liegt ein kleiner Zettel mit vier Antworten.',
      riddle: {
        question: 'Was wird nasser, je mehr es trocknet?',
        answer: { type: 'choice', options: ['Ein Schwamm', 'Ein Handtuch', 'Die Sonne', 'Ein Segel'], solution: 1 },
        hints: ['Du benutzt es meistens nach dem Duschen.', 'Es trocknet nicht sich selbst, sondern etwas anderes.'],
      },
    },
    {
      id: 's3',
      name: 'Dritte Wegmarke',
      position: { lat: 36.72537798408771, lng: -4.138895878009906 },
      chapter:
        'Die letzte Wegmarke! Maras Handschrift wird zittrig: „Das letzte Rätsel nennt das Werkzeug, ohne das ihr nie hierher gefunden hättet.“',
      riddle: {
        question: 'Ich habe Städte, aber keine Häuser. Wälder, aber keine Bäume. Wasser, aber keine Fische. Was bin ich?',
        answer: { type: 'text', solutions: ['Karte', 'Landkarte', 'Schatzkarte', 'Stadtplan'] },
        hints: ['Ihr schaut gerade ziemlich oft auf mich.', 'Ich bestehe aus Papier – oder heute aus Pixeln.'],
      },
    },
  ],
}
