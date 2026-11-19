# M291 – K3F, K4F, K5F

## Starten
1. Ordner in VS Code öffnen, Erweiterung **Live Server** installieren.
2. In K3F/ und K4F/ ist `config.js` vorhanden. `DEMO_MODE: true` nutzt `sample-data.json` (läuft ohne Key).
3. Für echte Daten: `DEMO_MODE: false`, `API_KEY` aus intervals.icu → Settings → Developer Settings selbst eintragen.
   **Key nie in Screenshots/Doku zeigen.**
4. Rechtsklick auf `index.html` → *Open with Live Server*. (Direkt per file:// geht `fetch` nicht.)

## Wichtig / ehrlich
- Ich habe die intervals.icu-API nicht live testen können (kein Key, keine Websuche). Endpoint und Basic-Auth (`API_KEY:<key>`) stammen aus meinem Wissen – bitte testen.
  Falls im Browser ein CORS-Fehler kommt, ist das ein guter Doku-Punkt (SOP/CORS, Ziel G3) – Alternative: eine API von der Projekt-Seite (z.B. Open-Meteo) nehmen, nur `url` und die Felder anpassen.
- Die Screenshots und Erkenntnisse im Portfolio machst du selbst; die .md-Dateien enthalten Platzhalter `[SCREENSHOT: …]`.
- K5F ist ein Gerüst: Arbeitsblatt verlangt die Webseite des Lehrbetriebs. Falls intervals.icu nicht dein Betrieb ist, Seite austauschen.
