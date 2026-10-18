# Schatzsuche-App – Projektbrief für Claude Code

## Ziel
Eine Web-App (PWA) für Schatzsuchen im echten Gelände. Die App erzeugt vollautomatisch aus wenigen Eckdaten eine Route mit echten Orten, eine Hintergrundgeschichte und Rätsel. Mehrere Spieler und Gruppen spielen gleichzeitig auf ihren Handys (iPhone und Android, ohne App Store).

## Spielablauf
1. Ein Spielleiter legt eine Jagd an mit: Startpunkt, Dauer, Schwierigkeit, Alter der Spieler, Fortbewegung (zu Fuß / Fahrrad; ÖPNV später), Anzahl Stationen, Anzahl Gruppen, zeitversetzter Start (Minuten).
2. Die App generiert Route, Story, Zwischenkapitel und Rätsel.
3. Spieler treten per Code oder Link einer Gruppe bei.
4. Pro Station: Rätsel lösen → Koordinaten der nächsten Station werden freigegeben → Ankunft per Geofence erkannt → Zwischenstory → nächstes Rätsel.
5. Finale: alle Gruppen kommen am selben Zielort an; Abschlussgeschichte und Rangliste.

## Technik-Stack
- Frontend: React + Vite + TypeScript, als PWA (Manifest + Service Worker, zum Startbildschirm hinzufügbar)
- Karte: Leaflet mit OpenStreetMap-Kacheln
- Backend: Firebase (Auth anonym + Gruppencode, Firestore für Echtzeit-Spielstand, Cloud Functions, Hosting)
- Orte (POIs): Overpass API (OpenStreetMap), z. B. Brunnen, Denkmäler, Spielplätze, Parks, Kirchen, Aussichtspunkte
- Routing/Distanzen: OpenRouteService (Profile foot-walking, cycling-regular)
- Story und Rätsel: Claude API, ausschließlich aus einer Cloud Function aufgerufen
- Sprache der Oberfläche und Inhalte: Deutsch

## Wichtige Regeln
- **Kein API-Schlüssel im Frontend.** Alle Aufrufe an Claude, Overpass und OpenRouteService laufen über Cloud Functions.
- **Rätsel dürfen keine erfundenen Ortsfakten enthalten.** Erlaubt sind ortsunabhängige Rätsel (Logik, Wortspiel, Rechnen) oder Fragen zu Daten, die aus OSM-Tags bzw. Wikipedia geladen und dem Modell mitgegeben werden.
- **Antworten robust prüfen:** bevorzugt Zahlen oder Multiple Choice; Freitext tolerant vergleichen (Groß/Klein, Umlaute, kleine Tippfehler).
- **Claude-Ausgabe als JSON** nach festem Schema (Story, Kapitel pro Station, Rätsel, Lösung, Antworttyp, 2 Tipps); Schema validieren, bei Fehler einmal neu anfragen.
- **Sicherheit:** keine Stationen direkt an Hauptverkehrsstraßen; Abstände an Alter und Fortbewegung anpassen.
- Geofence-Radius: 30 m (konfigurierbar), mit Hinweis bei schlechter GPS-Genauigkeit.

## Mehrere Gruppen
- Alle Gruppen haben dieselben Stationen, aber in rotierter Reihenfolge, damit niemand einer anderen Gruppe hinterherläuft.
- Gemeinsames Ziel als letzte Station.
- Startzeiten zeitversetzt; Spielleiter sieht den Fortschritt aller Gruppen live.

## Kostenschutz
- Login erforderlich; neue Jagden nur mit Einladungscode
- Kontingent: max. 3 generierte Jagden pro Nutzer und Monat
- Story/Rätsel nur einmal pro Jagd generieren (nicht pro Spieler)
- Firebase App Check aktivieren
- Ausgabenlimit in der Anthropic-Konsole setzen; Firebase-Budgetwarnung einrichten

## Umsetzung in Phasen
1. **Grundgerüst:** Repo, Vite/React/TS, PWA-Setup, Firebase-Projekt, Hosting-Deployment.
2. **Prototyp mit fester Jagd:** 3 hart codierte Stationen; Karte, GPS-Position, Geofence, Rätsel-Eingabe, Freischalten. Ziel: auf dem eigenen Handy draußen testbar.
3. **Generator:** Formular → Overpass-POIs → Routenauswahl mit OpenRouteService → Claude erzeugt Story und Rätsel → Speichern in Firestore.
4. **Multiplayer:** Beitritt per Code, Gruppen, rotierte Reihenfolge, zeitversetzter Start, Live-Übersicht für Spielleiter.
5. **Kostenschutz:** Einladungscodes, Kontingente, App Check.
6. **Feinschliff:** Tipp-System, Rangliste, Abschlussszene, Offline-Zwischenspeicher der aktuellen Station.

## Später
- ÖPNV als Fortbewegung (braucht Fahrplandaten)
- Fotos als Beweis an Stationen
- Eigene Themenwelten (Piraten, Detektiv, Agenten)
