import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'

const ICON_REL = /\b(?:shortcut\s+icon|apple-touch-icon(?:-precomposed)?|icon)\b/i

export function pickIconHref(html: string, pageUrl: string): string | null {
  const candidates: Array<{ href: string, score: number }> = []
  const linkRe = /<link\b([^>]*)>/gi
  let match: RegExpExecArray | null
  while ((match = linkRe.exec(html))) {
    const tag = match[1] || ''
    const rel = attr(tag, 'rel')
    const href = attr(tag, 'href')
    if (!rel || !href || !ICON_REL.test(rel)) continue
    const absolute = resolveHref(href, pageUrl)
    if (!absolute) continue
    candidates.push({ href: absolute, score: iconScore(rel, attr(tag, 'sizes'), absolute) })
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]?.href || null
}

export function fallbackFavicon(pageUrl: string): string | null {
  try {
    const url = new URL(pageUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return new URL('/favicon.ico', url.origin).toString()
  } catch {
    return null
  }
}

export async function resolveFavicon(pageUrl: string): Promise<string | null> {
  const page = await assertPublicHttpUrl(pageUrl)
  const html = await readHtml(page)
  if (html) {
    const picked = pickIconHref(html, page.toString())
    if (picked) return picked
  }
  return fallbackFavicon(page.toString())
}

function iconScore(rel: string, sizes: string, href: string) {
  const apple = /apple-touch-icon/i.test(rel)
  let size = sizes.split(/\s+/).reduce((max, token) => {
    const edge = Number(token.split('x')[0])
    return Number.isFinite(edge) ? Math.max(max, edge) : max
  }, 0)
  if (!size) {
    if (apple) size = 180
    else if (/\.ico(?:$|\?)/i.test(href)) size = 16
    else size = 32
  }
  return Math.min(size, 192) + (apple ? 0 : 5)
}

function attr(tag: string, name: string) {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i')
  const match = tag.match(re)
  return (match?.[1] || match?.[2] || match?.[3] || '').trim()
}

function resolveHref(href: string, pageUrl: string) {
  try {
    const url = new URL(href, pageUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

async function readHtml(url: URL) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(5000),
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'OpinaFavicon/1.0',
    },
  })
  if (!response.ok) return null
  const type = response.headers.get('content-type') || ''
  if (type && !/html|xml/i.test(type)) return null
  const text = await response.text()
  return text.slice(0, 200_000)
}

export async function assertPublicHttpUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid URL' })
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: 'URL must be http(s)' })
  }
  if (url.username || url.password) {
    throw createError({ statusCode: 400, statusMessage: 'URL must not include credentials' })
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map(record => record.address)
  if (!addresses.length || addresses.some(isBlockedAddress)) {
    throw createError({ statusCode: 400, statusMessage: 'URL host is not allowed' })
  }
  return url
}

function isBlockedAddress(address: string) {
  const version = isIP(address)
  if (version === 4) {
    const [a, b] = address.split('.').map(Number)
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true
    return false
  }
  if (version === 6) {
    const value = address.toLowerCase()
    return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80')
  }
  return true
}
