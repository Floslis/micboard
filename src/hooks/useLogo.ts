// ─────────────────────────────────────────────────────────────
// MicBoard – Logo Hook
// Loads the org logo from the data repo and applies it as favicon
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import type { BildConfig } from '../lib/bilder'
import { imageUrl } from '../lib/api'

const LOGO_PATH = 'images/logo.png'

export function useLogo(cfg: BildConfig | null): string | null {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!cfg) return
    const url = imageUrl(LOGO_PATH)
    // Probe with a HEAD-like fetch to see if the file exists
    const img = new Image()
    img.onload  = () => {
      setLogoUrl(url)
      applyFavicon(url)
    }
    img.onerror = () => setLogoUrl(null)
    // Cache-bust to pick up freshly uploaded logos
    img.src = url + '?t=' + Date.now()
  }, [cfg])

  return logoUrl
}

function applyFavicon(url: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = url
}

export { LOGO_PATH }
