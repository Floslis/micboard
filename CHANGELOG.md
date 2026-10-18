# Changelog

## 1.0.0
- **Selbst betreiben:** eigener kleiner Server statt Firebase und GitHub. Läuft auf jedem PHP-Webspace (`api/index.php`) oder mit Node auf Raspberry Pi und Desktop (`server.mjs`), ohne Zusatzpakete / **Self-hosted:** own small server instead of Firebase and GitHub. Runs on any PHP webspace or with Node on a Raspberry Pi or desktop, no extra packages
- **Keine Geheimnisse in der Seite:** Passwort, Daten und Fotos liegen auf dem Server, Anmeldung bleibt 30 Tage / **No secrets in the page:** password, data and photos stay on the server, login lasts 30 days
- **Ersteinrichtung im Browser:** beim ersten Öffnen Admin-Passwort festlegen / **First-run setup in the browser**
- **Live-Abgleich** jede Sekunde, Änderungen erscheinen in unter einer Sekunde / **Live sync** every second
- **Demo-Modus** mit Beispieldaten, setzt sich jede Nacht zurück / **Demo mode** that resets every night
- Umzugsskript von Firebase: `werkzeuge/umzug-firebase.py` / Migration script from Firebase
