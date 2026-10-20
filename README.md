# Schatzsuche-App

PWA für Schatzsuchen im echten Gelände (React + Vite + TypeScript, Leaflet/OpenStreetMap). Projektbrief und Phasenplan: [CLAUDE.md](CLAUDE.md).

**Stand:** Phase 1 (Grundgerüst, PWA), Phase 2 (Prototyp mit fester Jagd) und Phase 3 (Generator). Erzeugte Jagden liegen in Firestore, der Spielstand weiterhin lokal im Browser (`localStorage`).

## Entwicklung

```bash
npm install
npm run dev        # lokaler Server
npm test           # Unit-Tests (Geo, Antwortprüfung, Spielablauf)
npm run build      # Typecheck + Produktions-Build nach dist/
npm run icons      # PNG-Icons aus public/icon.svg neu erzeugen

npm --prefix functions install
npm --prefix functions test       # Tests der Cloud Functions (Route, Orte, Story-Prüfung, Fehlermeldungen)
npm --prefix functions run build  # TypeScript → functions/lib
```

## Deployment

Vercel baut und deployt automatisch jeden Push auf `main` (`vercel.json`: Framework Vite, Ausgabe `dist/`). GPS funktioniert nur über HTTPS – das ist bei Vercel gegeben.

Die Cloud Functions laufen nicht auf Vercel, sondern bei Firebase – siehe unten.

## Generator (Phase 3)

Ablauf der Cloud Function `generateHunt` (`functions/src/index.ts`, Region europe-west3):

1. **Budget** (`route.ts`): aus Dauer, Stationszahl, Schwierigkeit, Alter und Fortbewegung die Ziel-Weglänge, Mindestabstände und den Suchradius berechnen.
2. **Orte** (`poi.ts`): Overpass-Abfrage nach Brunnen, Denkmälern, Statuen, Kunstwerken, Aussichtspunkten, Spielplätzen, Parks und Kirchen. Aussortiert werden Orte näher als 25 m (Kinder unter 10: 40 m) an Hauptverkehrsstraßen, private Orte, Stolpersteine und große Flächen.
3. **Route** (`ors.ts`, `route.ts`): Weglängen-Matrix von OpenRouteService (`foot-walking` / `cycling-regular`), dann Auswahl eines Rundkurses plus gemeinsamem Ziel nahe dem Start. Bewertet werden Abweichung von der Ziellänge, gleich lange Wege für alle Gruppen (rotierte Startstation), Ortsqualität und Abwechslung.
4. **Fakten** (`wikipedia.ts`): ausgewählte OSM-Tags und – falls verlinkt – die Wikipedia-Einleitung.
5. **Story** (`story.ts`): Im gewählten Genre (`genres.ts`: Beliebig, Science-Fiction, Fantasy, Krimi, Die drei ???, Action, MacGyver, Horror, Piraten, Agenten, Zeitreise, Märchen; Horror für Kinder unter 12 nur als harmloser Grusel) erzeugt Claude Titel, Intro, Kapitel, Rätsel (Zahl / Multiple Choice / Freitext), Lösung und 2 Tipps als JSON nach festem Schema. Zusätzlich geprüft: jede Station genau einmal, gültige Antworten, und **faktenbasierte Rätsel müssen ein wörtliches Zitat aus den mitgegebenen Fakten enthalten, in dem die Lösung steht** – sonst wird einmal mit Fehlerliste nachgefragt. Kapitel funktionieren in jeder Reihenfolge (für rotierte Gruppen).
6. **Speichern** unter `hunts/{id}`; der Spielleiter sieht Route, Lösungen und einen Link zum Teilen (`/?jagd=ID`).

Fehler bei Schlüsseln, Guthaben oder Kontingenten (Claude, OpenRouteService, Overpass) kommen als verständliche Meldung mit „Was tun?“ im Formular an (`functions/src/errors.ts`).

**Vorläufiger Kostenschutz** bis Phase 5: Login (anonym), max. 3 Jagden pro Nutzer und Monat, max. 20 Jagden pro Tag insgesamt, höchstens 3 parallele Instanzen. Fehlgeschlagene Versuche zählen nicht.

## Cloud Functions deployen

Voraussetzungen: Firebase-Projekt `schatzsuche-d5d97` im **Blaze-Tarif** (Cloud Functions 2. Generation und Secret Manager brauchen ihn), Node 22, Firebase CLI (`npm install -g firebase-tools`).

```bash
firebase login                                  # einmalig, öffnet den Browser
firebase use                                    # muss schatzsuche-d5d97 zeigen (.firebaserc)
npm --prefix functions install

firebase functions:secrets:get ANTHROPIC_API_KEY          # Secrets vorhanden?
firebase functions:secrets:get OPENROUTESERVICE_API_KEY

firebase deploy --only firestore                # Sicherheitsregeln
firebase deploy --only functions                # baut functions/ und deployt generateHunt
firebase functions:log --only generateHunt      # Logs ansehen
```

Schlüssel tauschen: `firebase functions:secrets:set ANTHROPIC_API_KEY`, danach erneut `firebase deploy --only functions`.

## Spielablauf (Prototyp)

Intro → Station anlaufen (Karte, Entfernung, Richtung) → Ankunft per Geofence → Zwischenkapitel → Rätsel (Zahl, Multiple Choice oder Freitext mit Tippfehler-Toleranz, je 2 Tipps) → nächste Station wird freigeschaltet → … → Finale mit Dauer, Tipps und Fehlversuchen.

Die Test-Jagd steht in `src/game/demoHunt.ts` und ist über „Demo-Jagd spielen“ auf der Startseite (`/?jagd=demo-1`) erreichbar. Weil die Stationen nur 20–45 m auseinanderliegen, ist der Geofence dort auf 15 m gesetzt (Standard laut Brief: 30 m).

## Versteckter Testmodus

- **Einschalten:** fünfmal schnell auf den Titel tippen – oder die App mit `?test=1` öffnen.
- **Ausschalten:** erneut fünfmal tippen, „ausblenden“ oder `?test=0`.
- Bleibt über Neuladen hinweg aktiv (pro Gerät gespeichert).
- Funktionen: aktuelle Station per Knopfdruck als erreicht markieren, Geofence-Radius ändern, Jagd zurücksetzen, rohe GPS-Werte und Distanz anzeigen.
