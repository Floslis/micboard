// ─────────────────────────────────────────────────────────────
// MicBoard – Bilder vom eigenen Server
// Fotos liegen öffentlich unter images/ neben der App. BildConfig ist
// nur noch ein festes Objekt, damit die Komponenten unverändert bleiben.
// ─────────────────────────────────────────────────────────────

export type BildConfig = { readonly quelle: 'server' }
export const BILD_CFG: BildConfig = { quelle: 'server' }
export { imageUrl } from './api'
