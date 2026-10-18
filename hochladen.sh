#!/bin/bash
# Lädt die gebaute App per SFTP auf den IONOS-Webspace (Zugang wie flotech.dev, ~/.config/flotech-web/sftp.conf + Schlüsselbund flotech-sftp).
#   ./hochladen.sh gemeinde   → Ordner mic-icf/  (mic-icf.flotech.dev)
#   ./hochladen.sh demo       → Ordner micboard/ (micboard.flotech.dev), mit Demo-Vorlage
# Daten (daten/) und Fotos (images/) auf dem Server werden nie überschrieben.
set -euo pipefail
cd "$(dirname "$0")"
case "${1:-}" in
  gemeinde) ZIEL=mic-icf; DEMO=0 ;;
  demo)     ZIEL=micboard; DEMO=1 ;;
  *) echo "Aufruf: ./hochladen.sh gemeinde|demo" >&2; exit 1 ;;
esac
source "$HOME/.config/flotech-web/sftp.conf"
PASS=$(security find-generic-password -s flotech-sftp -a "$BENUTZER" -w)
npm run build >/dev/null
TMP=$(mktemp -d); cp -R dist/. "$TMP/"
[ "$DEMO" = 1 ] && mkdir -p "$TMP/demo" && cp demo-vorlage/db.json "$TMP/demo/db.json"
BATCH=$(mktemp)
{
  echo "-mkdir $ZIEL"; echo "cd $ZIEL"
  (cd "$TMP" && find . -type d ! -name . | sed 's#^\./##' | while read -r d; do echo "-mkdir \"$d\""; done)
  (cd "$TMP" && find . -type f ! -name .DS_Store | sed 's#^\./##' | while read -r f; do echo "put \"$TMP/$f\" \"$f\""; done)
} > "$BATCH"
echo "Ziel: $BENUTZER@$HOST:$ZIEL · $(grep -c '^put' "$BATCH") Dateien"
read -p "Hochladen? [j/N] " OK; [ "$OK" = "j" ] || { echo "Abgebrochen"; rm -r "$BATCH" "$TMP"; exit 1; }
SFTP_PASS="$PASS" /usr/bin/expect <<EXP
set timeout 120
spawn sftp -oBatchMode=no -oStrictHostKeyChecking=accept-new -b "$BATCH" "$BENUTZER@$HOST"
expect {
  -re "(?i)password:" { send "\$env(SFTP_PASS)\r"; exp_continue }
  eof
}
catch wait r
exit [lindex \$r 3]
EXP
rm -r "$BATCH" "$TMP"
echo "✅ Hochgeladen nach $ZIEL/"
