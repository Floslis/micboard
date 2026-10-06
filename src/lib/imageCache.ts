// ─────────────────────────────────────────────────────────────
// MicBoard – Authenticated Image Cache
//
// raw.githubusercontent.com returns 404 for private repos.
// This module fetches images via the authenticated GitHub
// Contents API and caches them as data-URLs in memory so
// display components work for both public AND private repos.
// ─────────────────────────────────────────────────────────────

import type { GitHubConfig } from './github'
import { sniffImageMime } from './imageUtils'

const cache = new Map<string, Promise<string>>()

function cacheKey(cfg: GitHubConfig, imagePath: string): string {
  return `${cfg.owner}/${cfg.repo}/${cfg.branch ?? 'main'}/${imagePath}`
}

async function fetchDataUrl(cfg: GitHubConfig, imagePath: string): Promise<string> {
  try {
    const ref  = cfg.branch ?? 'main'
    const url  = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${imagePath}?ref=${ref}&t=${Date.now()}`
    // Raw media type: the default JSON response carries no content for files
    // over 1 MB, which left such images blank without any error.
    const res  = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/vnd.github.raw',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    if (!res.ok) return ''
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.length === 0) return ''
    const mime = sniffImageMime(bytes) ?? mimeFromExtension(imagePath)
    return `data:${mime};base64,${bytesToBase64(bytes)}`
  } catch {
    return ''
  }
}

function mimeFromExtension(imagePath: string): string {
  const ext = (imagePath.split('.').pop() ?? 'webp').toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  return 'image/webp'
}

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked: String.fromCharCode(...bytes) overflows the call stack on large files
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Get a data-URL for an image, fetching it via auth API if needed. Cached for session lifetime. */
export function getAuthImageUrl(cfg: GitHubConfig, imagePath: string): Promise<string> {
  const key = cacheKey(cfg, imagePath)
  if (!cache.has(key)) {
    cache.set(key, fetchDataUrl(cfg, imagePath))
  }
  return cache.get(key)!
}

/** Bust the cache for a specific image (call after uploading a new version) */
export function invalidateAuthImage(cfg: GitHubConfig, imagePath: string): void {
  cache.delete(cacheKey(cfg, imagePath))
}
