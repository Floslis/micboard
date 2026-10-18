<?php
// MicBoard – Server für jeden PHP-Webspace (PHP 7.4+), ohne Datenbank und ohne Zusatzpakete.
// Daten liegen als JSON in ../daten/ (per .htaccess gesperrt), Fotos in ../images/ (öffentlich).
// Dieselbe Schnittstelle bietet server.mjs für Raspberry Pi und Desktop.
//
//   GET  ?r=state[&rev=N]         alles auf einmal; mit rev nur {unchanged:true}, wenn sich nichts geändert hat
//   POST ?r=setup {password}      erstes Admin-Passwort festlegen (nur solange keins gesetzt ist)
//   POST ?r=login {password}      → {token}
//   POST ?r=logout
//   PUT/DELETE ?r=users/<id>      PUT/DELETE ?r=displays/<id>
//   PUT ?r=roles   PUT ?r=settings   POST ?r=image {path, data(base64)}   POST ?r=password {old, new}
// Schreiben braucht den Kopf „Authorization: Bearer <token>“.

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const WURZEL = __DIR__ . '/..';
const DATEN = WURZEL . '/daten';
const BILDER = WURZEL . '/images';
const TOKEN_TAGE = 30;

function antwort($daten, int $code = 200): void { http_response_code($code); echo json_encode($daten, JSON_UNESCAPED_UNICODE); exit; }
function fehler(string $text, int $code = 400): void { antwort(['error' => $text], $code); }

function datei_lesen(string $name, $standard) {
    $p = DATEN . "/$name";
    if (!is_file($p)) return $standard;
    $d = json_decode((string)file_get_contents($p), true);
    return is_array($d) ? $d : $standard;
}
function datei_schreiben(string $name, $daten): void {
    $p = DATEN . "/$name"; $tmp = "$p.tmp" . getmypid();
    file_put_contents($tmp, json_encode($daten, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    rename($tmp, $p);
}
function leer(): array { return ['rev' => 1, 'users' => (object)[], 'displays' => (object)[], 'config' => ['roles' => [], 'settings' => (object)[]]]; }

function einrichten(): void {
    foreach ([DATEN, BILDER] as $o) if (!is_dir($o)) @mkdir($o, 0755, true);
    if (!is_file(DATEN . '/.htaccess')) file_put_contents(DATEN . '/.htaccess', "Require all denied\nDeny from all\n");
    if (!is_writable(DATEN)) fehler('Ordner daten/ ist nicht beschreibbar', 500);
    demo_zuruecksetzen();
}

// Demo: liegt demo/db.json neben der App, ist das Passwort „demo“ und die Daten werden jede Nacht frisch kopiert
function ist_demo(): bool { return is_file(WURZEL . '/demo/db.json'); }
function demo_zuruecksetzen(): void {
    if (!ist_demo()) return;
    $db = datei_lesen('db.json', null);
    $heute = date('Y-m-d');
    if ($db && ($db['demo_tag'] ?? '') === $heute) return;
    $neu = json_decode((string)file_get_contents(WURZEL . '/demo/db.json'), true) ?: leer();
    $neu['demo_tag'] = $heute; $neu['rev'] = (int)($db['rev'] ?? 0) + 1;
    datei_schreiben('db.json', $neu);
    datei_schreiben('auth.json', ['hash' => password_hash('demo', PASSWORD_DEFAULT), 'tokens' => (object)[]]);
}

// Alle Änderungen unter einer Sperre: lesen, ändern, Revision hochzählen, atomar schreiben
function aendern(callable $fn): array {
    $sperre = fopen(DATEN . '/.sperre', 'c');
    flock($sperre, LOCK_EX);
    $db = datei_lesen('db.json', leer());
    $db = $fn($db);
    $db['rev'] = (int)($db['rev'] ?? 0) + 1;
    datei_schreiben('db.json', $db);
    flock($sperre, LOCK_UN); fclose($sperre);
    return $db;
}

function koerper(): array {
    $d = json_decode((string)file_get_contents('php://input'), true);
    return is_array($d) ? $d : [];
}
function token_aus_kopf(): string {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$h && function_exists('getallheaders')) foreach (getallheaders() as $k => $v) if (strtolower($k) === 'authorization') $h = $v;
    return preg_match('/Bearer\s+([a-f0-9]{64})/i', $h, $m) ? strtolower($m[1]) : '';
}
function token_neu(array &$auth): string {
    $t = bin2hex(random_bytes(32));
    $jetzt = time();
    $auth['tokens'] = array_filter((array)($auth['tokens'] ?? []), fn($bis) => $bis > $jetzt);
    $auth['tokens'][hash('sha256', $t)] = $jetzt + TOKEN_TAGE * 86400;
    return $t;
}
function admin_pruefen(): void {
    $t = token_aus_kopf();
    $auth = datei_lesen('auth.json', []);
    $bis = $t ? (($auth['tokens'] ?? [])[hash('sha256', $t)] ?? 0) : 0;
    if ($bis < time()) fehler('Nicht angemeldet', 401);
}
function id_pruefen(string $id): string {
    if (!preg_match('/^[A-Za-z0-9_-]{1,80}$/', $id)) fehler('Ungültige ID');
    return $id;
}

einrichten();
$r = trim((string)($_GET['r'] ?? ''), '/');
$m = $_SERVER['REQUEST_METHOD'];
$teile = explode('/', $r);

if ($r === 'state' && $m === 'GET') {
    $db = datei_lesen('db.json', leer());
    if (isset($_GET['rev']) && (int)$_GET['rev'] === (int)$db['rev']) antwort(['rev' => (int)$db['rev'], 'unchanged' => true]);
    $auth = datei_lesen('auth.json', []);
    unset($db['demo_tag']);
    $db['setup'] = empty($auth['hash']);
    $db['demo'] = ist_demo();
    antwort($db);
}

if ($r === 'setup' && $m === 'POST') {
    $auth = datei_lesen('auth.json', []);
    if (!empty($auth['hash'])) fehler('Passwort ist schon gesetzt', 403);
    $pw = (string)(koerper()['password'] ?? '');
    if (mb_strlen($pw) < 6) fehler('Passwort braucht mindestens 6 Zeichen');
    $auth = ['hash' => password_hash($pw, PASSWORD_DEFAULT), 'tokens' => []];
    $t = token_neu($auth);
    datei_schreiben('auth.json', $auth);
    if (!is_file(DATEN . '/db.json')) datei_schreiben('db.json', leer());
    antwort(['token' => $t]);
}

if ($r === 'login' && $m === 'POST') {
    $auth = datei_lesen('auth.json', []);
    $pw = (string)(koerper()['password'] ?? '');
    if (empty($auth['hash']) || !password_verify($pw, $auth['hash'])) { sleep(1); fehler('Falsches Passwort', 401); }
    $t = token_neu($auth);
    datei_schreiben('auth.json', $auth);
    antwort(['token' => $t]);
}

if ($r === 'logout' && $m === 'POST') {
    $t = token_aus_kopf();
    $auth = datei_lesen('auth.json', []);
    if ($t) { unset($auth['tokens'][hash('sha256', $t)]); datei_schreiben('auth.json', $auth); }
    antwort(['ok' => true]);
}

// Ab hier nur mit Anmeldung
admin_pruefen();

if ($r === 'password' && $m === 'POST') {
    if (ist_demo()) fehler('In der Demo nicht möglich', 403);
    $k = koerper(); $auth = datei_lesen('auth.json', []);
    if (!password_verify((string)($k['old'] ?? ''), $auth['hash'] ?? '')) { sleep(1); fehler('Altes Passwort stimmt nicht', 403); }
    if (mb_strlen((string)($k['new'] ?? '')) < 6) fehler('Passwort braucht mindestens 6 Zeichen');
    $auth = ['hash' => password_hash((string)$k['new'], PASSWORD_DEFAULT), 'tokens' => []];
    $t = token_neu($auth);
    datei_schreiben('auth.json', $auth);
    antwort(['token' => $t]);
}

if (in_array($teile[0], ['users', 'displays'], true) && count($teile) === 2) {
    $art = $teile[0]; $id = id_pruefen($teile[1]);
    if ($m === 'PUT') {
        $obj = koerper();
        if (($obj['id'] ?? '') !== $id) fehler('ID passt nicht');
        $db = aendern(function ($db) use ($art, $id, $obj) { $db[$art] = (array)$db[$art]; $db[$art][$id] = $obj; return $db; });
        antwort(['rev' => $db['rev']]);
    }
    if ($m === 'DELETE') {
        $db = aendern(function ($db) use ($art, $id) { $db[$art] = (array)$db[$art]; unset($db[$art][$id]); if (!$db[$art]) $db[$art] = (object)[]; return $db; });
        antwort(['rev' => $db['rev']]);
    }
}

if (($r === 'roles' || $r === 'settings') && $m === 'PUT') {
    $wert = koerper();
    $db = aendern(function ($db) use ($r, $wert) { $db['config'][$r] = $r === 'roles' ? array_values(array_filter($wert, 'is_string')) : $wert; return $db; });
    antwort(['rev' => $db['rev']]);
}

if ($r === 'image' && $m === 'POST') {
    $k = koerper();
    $pfad = (string)($k['path'] ?? '');
    if (!preg_match('#^images/([a-z0-9][a-z0-9._-]{0,80})\.(webp|png|jpe?g|gif)$#i', $pfad)) fehler('Ungültiger Dateiname');
    $bytes = base64_decode((string)($k['data'] ?? ''), true);
    if ($bytes === false || strlen($bytes) > 6 * 1024 * 1024) fehler('Bild fehlt oder ist größer als 6 MB');
    $kopf = substr($bytes, 0, 12);
    $bild = substr($kopf, 0, 4) === "\x89PNG" || substr($kopf, 0, 3) === "\xFF\xD8\xFF" || substr($kopf, 0, 4) === 'GIF8' || (substr($kopf, 0, 4) === 'RIFF' && substr($kopf, 8, 4) === 'WEBP');
    if (!$bild) fehler('Keine Bilddatei');
    file_put_contents(WURZEL . '/' . $pfad, $bytes);
    $db = aendern(fn($db) => $db);   // Revision hochzählen, damit Anzeigen das neue Bild laden
    antwort(['path' => $pfad, 'rev' => $db['rev']]);
}

fehler('Unbekannte Anfrage', 404);
