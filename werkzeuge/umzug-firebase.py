#!/usr/bin/env python3
"""Einmaliger Umzug: Firebase-Export (firebase.json) + Bilder-Repo → daten/db.json und images/ für den eigenen Server.

  python3 werkzeuge/umzug-firebase.py <firebase.json> <bilder-repo-ordner> <ziel-ordner>

firebase.json bekommt man mit: curl -s "https://<projekt>.firebasedatabase.app/.json" > firebase.json
Das Admin-Passwort wird danach beim ersten Öffnen neu festgelegt.
"""
import json, shutil, sys
from pathlib import Path

quelle, bilder, ziel = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
fb = json.loads(quelle.read_text())
db = {"rev": 1, "users": fb.get("users") or {}, "displays": fb.get("displays") or {},
      "config": {"roles": (fb.get("config") or {}).get("roles") or [], "settings": (fb.get("config") or {}).get("settings") or {}}}
# Firebase speichert leere Listen gar nicht: Slots ergänzen, damit jedes Display eine Liste hat
for d in db["displays"].values():
    d.setdefault("slots", [])
(ziel / "daten").mkdir(parents=True, exist_ok=True)
(ziel / "images").mkdir(parents=True, exist_ok=True)
(ziel / "daten" / "db.json").write_text(json.dumps(db, ensure_ascii=False, indent=1))
kopiert = fehlt = 0
for u in db["users"].values():
    b = u.get("image")
    if not b: continue
    q = bilder / b
    if q.is_file():
        shutil.copy2(q, ziel / b); kopiert += 1
    else:
        print("fehlt:", b); fehlt += 1
logo = bilder / "config" / "logo.webp"
if logo.is_file(): shutil.copy2(logo, ziel / "images" / "logo.png"); print("Logo übernommen")
print(f"{len(db['users'])} Personen, {len(db['displays'])} Displays, {kopiert} Bilder kopiert, {fehlt} fehlen")
