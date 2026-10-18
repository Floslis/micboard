# Raspberry Pi als MicBoard-Anzeige (1–2 Monitore)

Ein Pi 4 oder 5 hat zwei HDMI-Ausgänge: ein Pi, zwei Anzeigen. / A Pi 4 or 5 has two HDMI outputs: one Pi, two displays.

1. **Raspberry Pi Imager:** *Raspberry Pi OS Lite (64-bit)*. In den Einstellungen: Hostname (z. B. `micboard-anzeige`), Benutzer, **SSH mit Schlüssel**, WLAN falls kein Kabel
2. Pi mit Monitoren und Netz verbinden, einschalten, 2 Minuten warten
3. Vom Rechner aus (Adressen aus dem Admin-Bereich, „öffnen“):
   ```sh
   ssh pi@micboard-anzeige.local 'bash -s -- "https://deine-adresse/#/display/<id-1>" "https://deine-adresse/#/display/<id-2>"' < einrichten.sh
   ssh pi@micboard-anzeige.local sudo reboot
   ```
4. Fertig: Der Pi startet direkt in die Anzeigen, Mauszeiger aus, kein Bildschirmschoner, nachts um 4:30 Neustart, Sicherheitsupdates automatisch

**Ändern:** `~/anzeige.conf` auf dem Pi (Adressen, Drehung), dann `sudo reboot`. Monitor 1 = HDMI-Buchse neben dem Stromanschluss.
