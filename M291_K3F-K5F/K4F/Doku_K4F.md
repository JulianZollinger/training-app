# K4F – JSON-Daten mit HTML-Elementen anzeigen

**Ziel F4:** Empfangene JSON-Daten in sinnvolle HTML-Elemente umwandeln.

## 1. Umsetzung
- **Schleife:** `for (const a of shown)` erzeugt pro Aktivität eine Karte (`<article>`).
- **Fallunterscheidung:** Sportart → CSS-Klasse (Farbe); Training Load ≥ 80 → Hinweis "harte Einheit"; fehlender Wert → "–".
- **Umwandlung:** Meter → km (`/1000`), Sekunden → Minuten/Stunden (`formatDuration`), Datum → `de-CH`.
- **Extra:** Filter nach Sportart, Sortierung nach Datum, Summe der Kilometer.
- `textContent` für den Titel, damit fremder Text nicht als HTML interpretiert wird.

## 2. Screenshots (selbst erstellen)
- [SCREENSHOT: Seite mit Karten]
- [SCREENSHOT: Filter auf "Run"]
- [SCREENSHOT: Code der Schleife und der if-Bedingung]

## 3. Erkenntnisse (ergänzen)
- Welche JSON-Felder habe ich genutzt und warum?
- Was ist der Vorteil von Karten gegenüber rohem JSON?
