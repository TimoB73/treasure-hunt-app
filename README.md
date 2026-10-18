# Schatzsuche-App

PWA für Schatzsuchen im echten Gelände (React + Vite + TypeScript, Leaflet/OpenStreetMap). Projektbrief und Phasenplan: [CLAUDE.md](CLAUDE.md).

**Stand:** Phase 1 (Grundgerüst, PWA) und Phase 2 (Prototyp mit fester Jagd aus 3 Stationen) – noch ohne Firebase. Der Spielstand liegt lokal im Browser (`localStorage`).

## Entwicklung

```bash
npm install
npm run dev        # lokaler Server
npm test           # Unit-Tests (Geo, Antwortprüfung, Spielablauf)
npm run build      # Typecheck + Produktions-Build nach dist/
npm run icons      # PNG-Icons aus public/icon.svg neu erzeugen
```

## Deployment

Vercel baut und deployt automatisch jeden Push auf `main` (`vercel.json`: Framework Vite, Ausgabe `dist/`). GPS funktioniert nur über HTTPS – das ist bei Vercel gegeben.

## Spielablauf (Prototyp)

Intro → Station anlaufen (Karte, Entfernung, Richtung) → Ankunft per Geofence → Zwischenkapitel → Rätsel (Zahl, Multiple Choice oder Freitext mit Tippfehler-Toleranz, je 2 Tipps) → nächste Station wird freigeschaltet → … → Finale mit Dauer, Tipps und Fehlversuchen.

Die Test-Jagd steht in `src/game/demoHunt.ts`. Weil die Stationen nur 20–45 m auseinanderliegen, ist der Geofence dort auf 15 m gesetzt (Standard laut Brief: 30 m).

## Versteckter Testmodus

- **Einschalten:** fünfmal schnell auf den Titel tippen – oder die App mit `?test=1` öffnen.
- **Ausschalten:** erneut fünfmal tippen, „ausblenden“ oder `?test=0`.
- Bleibt über Neuladen hinweg aktiv (pro Gerät gespeichert).
- Funktionen: aktuelle Station per Knopfdruck als erreicht markieren, Geofence-Radius ändern, Jagd zurücksetzen, rohe GPS-Werte und Distanz anzeigen.
