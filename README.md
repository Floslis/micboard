# MicBoard

**English** · [Deutsch](README.de.md)

**Who's on which mic?** MicBoard shows it live on any screen or as an OBS browser source. A volunteer assigns people to mics in the admin panel, every display updates within a second. Built for our church, used every Sunday.

**👉 Try the demo: [micboard.flotech.dev](https://micboard.flotech.dev)** (password `demo`, resets every night)

![Display](docs/display.png)

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/floslist)

## Features
- **Live sync:** assignments show up on every display in under a second, the admin panel updates instantly
- **Multiple displays:** speaker screen, band screen, livestream scene, each with its own slots (Preacher, Vox 1, Guitar …) and aspect ratio (16:9, 21:9, 32:9)
- **Photos** per person, with crop and zoom
- **Quick add:** create a guest right in the assignment dialog, removed automatically when unassigned
- **Self-hosted:** your data stays on your server. No accounts, no cloud services, no build secrets
- **Runs anywhere:** any PHP webspace, a Raspberry Pi or a desktop computer

![Admin](docs/admin.png)

## Install

Download **micboard.zip** from the [latest release](https://github.com/Floslis/micboard/releases/latest) and unpack it. Then pick one:

### A) PHP webspace (any host with PHP 7.4+)
1. Upload the folder's contents via FTP/SFTP, e.g. to `micboard/`
2. Open the address in the browser and set the admin password
3. Done. Data lives in `daten/` (locked by `.htaccess`), photos in `images/`

### B) Raspberry Pi or desktop (Node.js 18+)
```sh
cd micboard
node server.mjs            # → http://<this-computer>:8080
PORT=80 node server.mjs    # other port
```
On a Raspberry Pi, run it as a service so it starts on boot (`/etc/systemd/system/micboard.service`):
```ini
[Unit]
Description=MicBoard
After=network-online.target
[Service]
WorkingDirectory=/home/pi/micboard
ExecStart=/usr/bin/node server.mjs
Restart=always
User=pi
[Install]
WantedBy=multi-user.target
```
`sudo systemctl enable --now micboard`

### Displays
Open `https://your-address/#/display/<id>` on the screen, or use it as an OBS browser source. The admin panel shows the link for each display.

## How it works
- React app (Vite, Tailwind) talks to a tiny server: `api/index.php` on a webspace or `server.mjs` with Node. Both offer the same API and store everything in JSON files
- Displays ask once per second whether anything changed. The answer is a few bytes unless something did
- The admin password is stored hashed. A login gives the browser a key valid for 30 days
- Demo mode: a `demo/db.json` next to the app sets the password to `demo` and restores the data every night

## Development
```sh
npm install
npm run server   # API on :8080 (data in .dev/)
npm run dev      # app on :5173, forwards /api to :8080
```
Moving from the old Firebase version: `werkzeuge/umzug-firebase.py`.

## License
[MIT](LICENSE) · A project by **[FLOTECH](https://flotech.dev)**
