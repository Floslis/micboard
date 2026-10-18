# MicBoard – Notizen für Claude

## Branching-Workflow

**Wir arbeiten immer auf `dev`, nicht auf `main`.**

- `main` = stabile, öffentliche Version (GitHub Pages Live-Deployment)
- `dev` = aktiver Entwicklungsbranch – alle neuen Features und Fixes kommen hierhin
- `feature/xyz` = kurzlebige Branches für größere Einzelfeatures, abzweigen von `dev`

Vor jeder Arbeitssession sicherstellen:
```bash
git checkout dev
git pull origin dev
```

Commits pushen:
```bash
git add -A && git commit -m "typ: beschreibung"
git push origin dev
```

Wenn `dev` reif für Production:
```bash
git checkout main && git merge dev && git push origin main
```

---

## Git-Befehle (wichtige Regeln)

- Der Nutzer braucht **keinen Token** – GitHub ist lokal im Terminal gespeichert.
- Der Sandbox-Prozess hinterlässt immer eine `.git/HEAD.lock`-Datei.  
  → Alle Befehle die `git checkout` oder `git merge` enthalten **immer als Einzeiler** mit `rm -f .git/HEAD.lock &&` davor senden.
- Befehle immer **einzeln pro Zeile** senden, nie als Block mit Kommentaren dazwischen.

```bash
# Dev pushen
git push origin dev

# Auf main mergen und pushen
rm -f .git/HEAD.lock && git checkout main && git merge dev && git push origin main && rm -f .git/HEAD.lock && git checkout dev
```

---

## Projekt-Überblick

**MicBoard** – Live-Mikrofon- und Positionsanzeige für Kirchen/Events. **Seit v1.0 selbst betrieben**, kein Firebase, kein GitHub-Speicher, keine Geheimnisse im Build.
Tech: React 18 + TypeScript + Vite + Tailwind, dazu ein winziger eigener Server in zwei Fassungen mit gleicher Schnittstelle:

| Datei | Wofür |
|---|---|
| `public/api/index.php` | Server für jeden PHP-Webspace (IONOS: Gemeinde `mic-icf.flotech.dev`, Demo `micboard.flotech.dev`) |
| `public/server.mjs` | Server für Raspberry Pi und Desktop (Node 18+, ohne Pakete) |
| `src/lib/api.ts` | Datenschicht der App: gleiche Funktionen wie früher `firebase.ts`, Live-Abgleich per Abfrage jede Sekunde (`?r=state&rev=N`) |
| `src/lib/bilder.ts`, `hooks/useAuthImage.ts` | Fotos kommen öffentlich aus `images/`, jeder Upload bekommt einen neuen Dateinamen |
| `src/hooks/useAuth.tsx` | Anmeldung: Passwort → Schlüssel für 30 Tage in localStorage |
| `demo-vorlage/db.json` | Demo-Daten (ausgedachte Personen). Liegt sie als `demo/db.json` neben der App: Passwort `demo`, täglicher Reset |
| `werkzeuge/umzug-firebase.py` | einmaliger Umzug aus Firebase + Bilder-Repo |
| `hochladen.sh gemeinde|demo` | baut und lädt per SFTP hoch, `daten/` und `images/` auf dem Server bleiben unberührt |

Daten auf dem Server: `daten/db.json` (alles, mit `rev`), `daten/auth.json` (Passwort-Hash, Token-Hashes), beides per `.htaccess` gesperrt.
Dateinamen `useFirebase.ts`/`useGitHub.ts` sind historisch, die Inhalte nutzen den eigenen Server.

Entwickeln: `npm run server` (Daten in `.dev/`) und `npm run dev` (Proxy `/api` → :8080).
Release: Version in `package.json` erhöhen + Abschnitt in `CHANGELOG.md` → Action baut `micboard.zip`.

Sicherung des alten Stands (Firebase-Export + Bilder-Repo, 18.10.2026): `../Micbard-Sicherung-2026-10-18/`

---

## Roadmap (geplante Features)
- Planning Center Online (PCO) Integration
- Shure Wireless Integration (Axient Digital, ULX-D, QLXD)
- Sennheiser Integration (Digital 6000, EW-DX)
