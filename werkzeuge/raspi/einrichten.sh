#!/bin/bash
# MicBoard-Anzeige auf einem Raspberry Pi (4 oder 5) für einen oder zwei Monitore.
# Läuft auf dem Pi, einmal nach dem Aufspielen von Raspberry Pi OS Lite (64-bit):
#   ssh <benutzer>@<pi> 'bash -s -- "<adresse-monitor-1>" "<adresse-monitor-2>"' < einrichten.sh
# Danach: Pi startet direkt in die Anzeige. Adressen später ändern: ~/anzeige.conf bearbeiten, Pi neu starten.
set -euo pipefail
LINKS="${1:?Adresse für Monitor 1 fehlt}"
RECHTS="${2:-}"
ICH="$(whoami)"

echo "▶ 1/6 Pakete (dauert ein paar Minuten)"
sudo apt-get update -qq
BROWSER=chromium; apt-cache show chromium >/dev/null 2>&1 || BROWSER=chromium-browser
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
  xserver-xorg xinit x11-xserver-utils openbox unclutter "$BROWSER" unattended-upgrades fonts-noto-color-emoji >/dev/null

echo "▶ 2/6 Adressen in ~/anzeige.conf"
cat > ~/anzeige.conf <<EOF
# Was auf welchem Monitor läuft. Ändern, dann: sudo reboot
# Monitor 1 = HDMI-Buchse neben dem Stromanschluss, Monitor 2 = die andere
LINKS="$LINKS"
RECHTS="$RECHTS"
# Bild drehen: normal, left, right, inverted
DREHUNG_LINKS=normal
DREHUNG_RECHTS=normal
EOF

echo "▶ 3/6 Anzeige-Skript ~/kiosk.sh"
cat > ~/kiosk.sh <<'EOF'
#!/bin/bash
# Startet je Monitor ein Chromium im Vollbild. Stürzt eins ab, kommt es nach 3 s wieder.
# Alle 10 s Blick auf die Monitore: kommt einer dazu oder fällt weg, wird neu angeordnet.
BROWSER=$(command -v chromium || command -v chromium-browser)
xset s off; xset s noblank; xset -dpms
unclutter -idle 1 -root &
openbox &

ausgaenge() { xrandr | awk '/ connected/{print $1}' | sort | tr '\n' ' '; }

starte() {  # name adresse x y breite hoehe
  while true; do
    source ~/anzeige.conf
    local url; [ "$1" = links ] && url="$LINKS" || url="$RECHTS"
    rm -f ~/.config/kiosk-$1/Singleton*
    # Abstürze nicht als „Wiederherstellen?“-Leiste anzeigen
    sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"Crashed"/"exit_type":"Normal"/' ~/.config/kiosk-$1/Default/Preferences 2>/dev/null
    "$BROWSER" --kiosk --user-data-dir="$HOME/.config/kiosk-$1" --window-position=$3,$4 --window-size=$5,$6 \
      --noerrdialogs --disable-infobars --disable-session-crashed-bubble --no-first-run \
      --disable-features=Translate --check-for-update-interval=31536000 --password-store=basic "$url"
    sleep 3
  done
}

while true; do
  source ~/anzeige.conf
  read -r -a A <<< "$(ausgaenge)"
  if [ ${#A[@]} -ge 2 ]; then
    xrandr --output "${A[0]}" --auto --rotate "$DREHUNG_LINKS" --pos 0x0 --output "${A[1]}" --auto --rotate "$DREHUNG_RECHTS" --right-of "${A[0]}"
  elif [ ${#A[@]} -eq 1 ]; then
    xrandr --output "${A[0]}" --auto --rotate "$DREHUNG_LINKS" --pos 0x0
  fi
  sleep 1
  pids=()
  i=0
  while read -r geo; do   # z. B. 1920/509x1080/286+0+0
    w=${geo%%/*}; rest=${geo#*x}; h=${rest%%/*}; xy=${geo#*+}; x=${xy%%+*}; y=${xy#*+}
    name=links; [ $i -eq 1 ] && name=rechts
    if [ $name = links ] || [ -n "$RECHTS" ]; then starte $name "" "$x" "$y" "$w" "$h" & pids+=($!); fi
    i=$((i+1))
  done < <(xrandr --listmonitors | awk 'NR>1{print $3}' | sort -t+ -k2 -n | head -2)
  jetzt="$(ausgaenge)"
  while [ "$(ausgaenge)" = "$jetzt" ]; do sleep 10; done
  kill "${pids[@]}" 2>/dev/null; pkill -f "kiosk-" ; sleep 2
done
EOF
chmod +x ~/kiosk.sh
echo 'exec ~/kiosk.sh' > ~/.xinitrc

echo "▶ 4/6 Automatisch anmelden und Anzeige starten"
sudo raspi-config nonint do_boot_behaviour B2   # Konsole mit automatischer Anmeldung
grep -q 'startx' ~/.bash_profile 2>/dev/null || cat >> ~/.bash_profile <<'EOF'
# MicBoard-Anzeige: auf dem ersten Bildschirm-Terminal direkt starten
if [ -z "$DISPLAY" ] && [ "$(tty)" = /dev/tty1 ]; then exec startx -- -nocursor >/dev/null 2>&1; fi
EOF

echo "▶ 5/6 Nachts neu starten (4:30), Sicherheitsupdates automatisch"
sudo tee /etc/systemd/system/anzeige-neustart.service >/dev/null <<'EOF'
[Unit]
Description=Anzeige nachts neu starten
[Service]
Type=oneshot
ExecStart=/usr/bin/systemctl reboot
EOF
sudo tee /etc/systemd/system/anzeige-neustart.timer >/dev/null <<'EOF'
[Unit]
Description=Anzeige jede Nacht um 4:30 neu starten
[Timer]
OnCalendar=*-*-* 04:30
[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload && sudo systemctl enable -q --now anzeige-neustart.timer
echo 'APT::Periodic::Update-Package-Lists "1"; APT::Periodic::Unattended-Upgrade "1";' | sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null

echo "▶ 6/6 Bildschirm nie abschalten, kein Overscan-Rand"
sudo raspi-config nonint do_blanking 1 2>/dev/null || true
sudo raspi-config nonint do_overscan 1 2>/dev/null || true

echo "✅ Fertig für $ICH. Jetzt: sudo reboot"
