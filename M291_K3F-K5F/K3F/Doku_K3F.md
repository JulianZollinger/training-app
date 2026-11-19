# K3F – JSON asynchron von einer HTTP-Schnittstelle empfangen

**Ziel F3:** JSON-Daten asynchron mit JavaScript empfangen; bei Fehler Meldung in der Oberfläche.

## 1. Gewählte API
intervals.icu (Trainingsdaten), Endpoint `GET /api/v1/athlete/{id}/activities?oldest=…&newest=…`, Antwort: JSON-Array von Aktivitäten.

## 2. Umsetzung
- `fetch()` ist asynchron: `async/await` wartet auf die Antwort, ohne dass die Seite blockiert.
- `response.ok` prüft den HTTP-Statuscode (z.B. 401 = falscher Key, 404 = falsche URL).
- `response.json()` schlägt fehl, wenn die Antwort kein JSON ist → `catch`.
- Zusätzlich wird geprüft, ob ein nicht-leeres Array kommt ("sinnvolle Daten").
- Alle Fehler (auch Netzwerk/CORS) landen im `catch` und werden im roten Fehlerfeld angezeigt.

## 3. Screenshots (selbst erstellen)
- [SCREENSHOT: Code in VS Code (fetch + try/catch)]
- [SCREENSHOT: Browser mit geladenem JSON]
- [SCREENSHOT: Fehlerfall, z.B. falscher Key → Status 401 oder URL falsch geschrieben]
- [SCREENSHOT: DevTools → Network-Tab mit dem Request und Statuscode]

## 4. Erkenntnisse (in eigenen Worten ergänzen)
- Warum asynchron? Seite bleibt bedienbar, nur Daten werden nachgeladen.
- Was bedeutet Statuscode 200 / 401 / 404?
- Was passiert bei CORS? (Server muss den Zugriff von anderer Herkunft erlauben.)
