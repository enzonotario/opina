import type { H3Event } from 'h3'
import { getHeader, getRequestHeader } from 'h3'
import { parseUserAgent } from './user-agent'

/** Client cannot set provenance / geo / UA fields — server owns those. */
const RESERVED_META_KEYS = new Set([
  'imported',
  'source',
  'importKey',
  'externalId',
  'externalUrl',
  'hotjarNumber',
  'hotjarResponseUrl',
  'country',
  'region',
  'city',
  'browser',
  'os',
])

function asShortString(value: unknown, max = 128): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, max)
}

/** Keep custom setMeta keys; strip reserved; allow resolution from client. */
export function sanitizeClientMetadata(
  raw: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!key || key.length > 64) continue
    if (RESERVED_META_KEYS.has(key)) continue
    if (key === 'resolution') {
      const resolution = asShortString(value, 32)
      if (resolution && /^\d{2,5}x\d{2,5}$/i.test(resolution)) {
        out.resolution = resolution
      }
      continue
    }
    if (typeof value === 'string') {
      const s = asShortString(value, 256)
      if (s) out[key] = s
      continue
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value
      continue
    }
    if (typeof value === 'boolean') {
      out[key] = value
    }
  }
  return out
}

export function geoFromRequest(event: H3Event): {
  country?: string
  region?: string
  city?: string
} {
  const countryRaw = (
    getRequestHeader(event, 'cf-ipcountry')
    || getRequestHeader(event, 'x-vercel-ip-country')
    || getRequestHeader(event, 'x-country-code')
    || ''
  ).trim().toUpperCase()

  const country = countryRaw
    && countryRaw !== 'XX'
    && countryRaw !== 'T1'
    && countryRaw.length <= 8
    ? countryRaw
    : undefined

  const region = asShortString(
    getRequestHeader(event, 'x-vercel-ip-country-region')
    || getRequestHeader(event, 'cf-region'),
    64,
  )

  let city: string | undefined
  const cityRaw = getRequestHeader(event, 'x-vercel-ip-city')
  if (cityRaw) {
    try {
      city = asShortString(decodeURIComponent(cityRaw), 64)
    }
    catch {
      city = asShortString(cityRaw, 64)
    }
  }

  return {
    ...(country ? { country } : {}),
    ...(region ? { region } : {}),
    ...(city ? { city } : {}),
  }
}

/** Merge client meta + UA + edge geo into the stored metadata object. */
export function buildResponseMetadata(
  event: H3Event,
  clientMeta: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  const meta = sanitizeClientMetadata(clientMeta)
  const ua = parseUserAgent(getHeader(event, 'user-agent'))
  const geo = geoFromRequest(event)
  return {
    ...meta,
    ...ua,
    ...geo,
  }
}
