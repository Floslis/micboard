#!/usr/bin/env node
// MicBoard – Server für Raspberry Pi und Desktop (Node 18+), ohne Zusatzpakete.
// Gleiche Schnittstelle wie api/index.php, gleiche Ordner: daten/ (gesperrt), images/ (öffentlich).
//   node server.mjs                 → http://<rechner>:8080
//   PORT=80 node server.mjs         → anderer Port
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const WURZEL = path.dirname(fileURLToPath(import.meta.url))
// MICBOARD_ORDNER: Daten und Fotos woanders ablegen (beim Entwickeln, damit nichts im Build landet)
const ORDNER = process.env.MICBOARD_ORDNER ? path.resolve(process.env.MICBOARD_ORDNER) : WURZEL
const DATEN = path.join(ORDNER, 'daten')
const BILDER = path.join(ORDNER, 'images')
const PORT = Number(process.env.PORT || 8080)
const TOKEN_TAGE = 30
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }

for (const o of [DATEN, BILDER]) fs.mkdirSync(o, { recursive: true })

const leer = () => ({ rev: 1, users: {}, displays: {}, config: { roles: [], settings: {} } })
function lesen(name, standard) {
  try { return JSON.parse(fs.readFileSync(path.join(DATEN, name), 'utf8')) } catch { return standard }
}
function schreiben(name, daten) {
  const p = path.join(DATEN, name), tmp = `${p}.tmp${process.pid}`
  fs.writeFileSync(tmp, JSON.stringify(daten, null, 1))
  fs.renameSync(tmp, p)
}
// Node arbeitet die Anfragen nacheinander ab, eine Sperre wie in PHP ist nicht nötig
function aendern(fn) {
  const db = fn(lesen('db.json', leer()))
  db.rev = (db.rev || 0) + 1
  schreiben('db.json', db)
  return db
}

// Demo wie in PHP: demo/db.json vorhanden → Passwort „demo“, jeden Tag frisch
const istDemo = () => fs.existsSync(path.join(WURZEL, 'demo', 'db.json'))
const heute = () => new Date().toISOString().slice(0, 10)
function demoZuruecksetzen() {
  if (!istDemo()) return
  const db = lesen('db.json', null)
  if (db && db.demo_tag === heute()) return
  const neu = JSON.parse(fs.readFileSync(path.join(WURZEL, 'demo', 'db.json'), 'utf8'))
  neu.demo_tag = heute(); neu.rev = (db?.rev || 0) + 1
  schreiben('db.json', neu)
  schreiben('auth.json', { hash: hashPw('demo'), tokens: {} })
}

// Passwort-Hash mit scrypt (eingebaut). Hashes aus PHP (bcrypt) erkennt Node nicht, darum je Server eigenes Passwort
function hashPw(pw) {
  const salz = crypto.randomBytes(16).toString('hex')
  return `scrypt$${salz}$${crypto.scryptSync(pw, salz, 32).toString('hex')}`
}
function pruefePw(pw, hash) {
  const [art, salz, wert] = String(hash || '').split('$')
  if (art !== 'scrypt' || !salz || !wert) return false
  const ist = crypto.scryptSync(pw, salz, 32)
  return crypto.timingSafeEqual(ist, Buffer.from(wert, 'hex'))
}
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex')
function tokenNeu(auth) {
  const t = crypto.randomBytes(32).toString('hex'), jetzt = Date.now() / 1000
  auth.tokens = Object.fromEntries(Object.entries(auth.tokens || {}).filter(([, bis]) => bis > jetzt))
  auth.tokens[sha(t)] = jetzt + TOKEN_TAGE * 86400
  return t
}
function angemeldet(req) {
  const m = /Bearer\s+([a-f0-9]{64})/i.exec(req.headers.authorization || '')
  if (!m) return false
  const bis = (lesen('auth.json', {}).tokens || {})[sha(m[1].toLowerCase())] || 0
  return bis > Date.now() / 1000
}

function senden(res, code, daten) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(daten))
}
const warten = (ms) => new Promise((r) => setTimeout(r, ms))
function koerper(req) {
  return new Promise((ok) => {
    let d = '', zuGross = false
    req.on('data', (c) => { d += c; if (d.length > 9e6) { zuGross = true; req.destroy() } })
    req.on('end', () => { if (zuGross) return ok({}); try { ok(JSON.parse(d || '{}')) } catch { ok({}) } })
  })
}

async function api(req, res, r) {
  demoZuruecksetzen()
  const m = req.method, teile = r.split('/')
  const url = new URL(req.url, 'http://x')

  if (r === 'state' && m === 'GET') {
    const db = lesen('db.json', leer())
    if (url.searchParams.has('rev') && Number(url.searchParams.get('rev')) === db.rev) return senden(res, 200, { rev: db.rev, unchanged: true })
    delete db.demo_tag
    db.setup = !lesen('auth.json', {}).hash
    db.demo = istDemo()
    return senden(res, 200, db)
  }
  if (r === 'setup' && m === 'POST') {
    if (lesen('auth.json', {}).hash) return senden(res, 403, { error: 'Passwort ist schon gesetzt' })
    const pw = String((await koerper(req)).password || '')
    if (pw.length < 6) return senden(res, 400, { error: 'Passwort braucht mindestens 6 Zeichen' })
    const auth = { hash: hashPw(pw), tokens: {} }, t = tokenNeu(auth)
    schreiben('auth.json', auth)
    if (!fs.existsSync(path.join(DATEN, 'db.json'))) schreiben('db.json', leer())
    return senden(res, 200, { token: t })
  }
  if (r === 'login' && m === 'POST') {
    const auth = lesen('auth.json', {}), pw = String((await koerper(req)).password || '')
    if (!auth.hash || !pruefePw(pw, auth.hash)) { await warten(1000); return senden(res, 401, { error: 'Falsches Passwort' }) }
    const t = tokenNeu(auth); schreiben('auth.json', auth)
    return senden(res, 200, { token: t })
  }
  if (r === 'logout' && m === 'POST') {
    const mm = /Bearer\s+([a-f0-9]{64})/i.exec(req.headers.authorization || '')
    if (mm) { const auth = lesen('auth.json', {}); delete (auth.tokens || {})[sha(mm[1].toLowerCase())]; schreiben('auth.json', auth) }
    return senden(res, 200, { ok: true })
  }

  if (!angemeldet(req)) return senden(res, 401, { error: 'Nicht angemeldet' })

  if (r === 'password' && m === 'POST') {
    if (istDemo()) return senden(res, 403, { error: 'In der Demo nicht möglich' })
    const k = await koerper(req), auth = lesen('auth.json', {})
    if (!pruefePw(String(k.old || ''), auth.hash)) { await warten(1000); return senden(res, 403, { error: 'Altes Passwort stimmt nicht' }) }
    if (String(k.new || '').length < 6) return senden(res, 400, { error: 'Passwort braucht mindestens 6 Zeichen' })
    const neu = { hash: hashPw(String(k.new)), tokens: {} }, t = tokenNeu(neu)
    schreiben('auth.json', neu)
    return senden(res, 200, { token: t })
  }
  if ((teile[0] === 'users' || teile[0] === 'displays') && teile.length === 2) {
    const [art, id] = teile
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return senden(res, 400, { error: 'Ungültige ID' })
    if (m === 'PUT') {
      const obj = await koerper(req)
      if (obj.id !== id) return senden(res, 400, { error: 'ID passt nicht' })
      const db = aendern((db) => { db[art] = db[art] || {}; db[art][id] = obj; return db })
      return senden(res, 200, { rev: db.rev })
    }
    if (m === 'DELETE') {
      const db = aendern((db) => { delete (db[art] || {})[id]; return db })
      return senden(res, 200, { rev: db.rev })
    }
  }
  if ((r === 'roles' || r === 'settings') && m === 'PUT') {
    const wert = await koerper(req)
    const db = aendern((db) => { db.config = db.config || {}; db.config[r] = r === 'roles' ? Object.values(wert).filter((x) => typeof x === 'string') : wert; return db })
    return senden(res, 200, { rev: db.rev })
  }
  if (r === 'image' && m === 'POST') {
    const k = await koerper(req), pfad = String(k.path || '')
    if (!/^images\/[a-z0-9][a-z0-9._-]{0,80}\.(webp|png|jpe?g|gif)$/i.test(pfad)) return senden(res, 400, { error: 'Ungültiger Dateiname' })
    const b = Buffer.from(String(k.data || ''), 'base64')
    if (!b.length || b.length > 6 * 1024 * 1024) return senden(res, 400, { error: 'Bild fehlt oder ist größer als 6 MB' })
    const kopf = b.subarray(0, 12).toString('latin1')
    const bild = kopf.startsWith('\x89PNG') || kopf.startsWith('\xFF\xD8\xFF') || kopf.startsWith('GIF8') || (kopf.startsWith('RIFF') && kopf.slice(8, 12) === 'WEBP')
    if (!bild) return senden(res, 400, { error: 'Keine Bilddatei' })
    fs.writeFileSync(path.join(ORDNER, pfad), b)
    const db = aendern((db) => db)
    return senden(res, 200, { path: pfad, rev: db.rev })
  }
  return senden(res, 404, { error: 'Unbekannte Anfrage' })
}

function datei(req, res, pfadname) {
  let rel = decodeURIComponent(pfadname).replace(/^\/+/, '') || 'index.html'
  // Gesperrt: Daten, Server-Dateien und versteckte Dateien
  if (/^(daten|demo)(\/|$)|^server\.mjs$|(^|\/)\./.test(rel)) { res.writeHead(403); return res.end() }
  const basis = rel.startsWith('images/') ? ORDNER : WURZEL
  const p = path.join(basis, rel)
  if (!p.startsWith(basis + path.sep)) { res.writeHead(403); return res.end() }
  fs.stat(p, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end('Nicht gefunden') }
    const typ = TYPEN[path.extname(p).toLowerCase()] || 'application/octet-stream'
    const cache = rel === 'index.html' ? 'no-cache' : rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
    res.writeHead(200, { 'Content-Type': typ, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' })
    fs.createReadStream(p).pipe(res)
  })
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  // gleiche Adresse wie beim Webspace: api/?r=… oder api/index.php?r=…
  if (url.pathname === '/api/' || url.pathname === '/api' || url.pathname === '/api/index.php') {
    return api(req, res, (url.searchParams.get('r') || '').replace(/^\/+|\/+$/g, '')).catch((e) => senden(res, 500, { error: String(e.message || e) }))
  }
  datei(req, res, url.pathname)
}).listen(PORT, () => {
  const adressen = Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address)
  console.log(`MicBoard läuft: http://localhost:${PORT}` + adressen.map((a) => `  ·  http://${a}:${PORT}`).join(''))
})
