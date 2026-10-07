export type CsvImportMapping = {
  score: string
  comment: string
  date: string
  url: string
  device: string
  visitor: string
}

const HOTJAR_META = new Set([
  'Number',
  'User',
  'Date Submitted',
  'Country',
  'Region',
  'City',
  'Source URL',
  'Device',
  'Browser',
  'OS',
  'Resolution',
  'Hotjar User ID',
  'Response URL',
  'Name',
  'Email',
  'Sentiment',
])

/** Minimal RFC4180 CSV parser (quoted fields, commas, newlines). */
export function parseCsv(text: string): { headers: string[], records: Record<string, string>[] } {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''))
  if (!rows.length) return { headers: [], records: [] }
  const headers = rows[0]!.map(h => h.trim())
  const records = rows.slice(1)
    .filter(row => row.some(cell => cell.trim() !== ''))
    .map((row) => {
      const record: Record<string, string> = {}
      for (let i = 0; i < headers.length; i++) {
        record[headers[i]!] = (row[i] ?? '').trim()
      }
      return record
    })
  return { headers, records }
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        }
        else {
          inQuotes = false
        }
      }
      else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    if (ch === '\r') continue
    cell += ch
  }

  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function isQuestionHeader(header: string) {
  if (!header || HOTJAR_META.has(header)) return false
  if (header.startsWith('Tags for:')) return false
  return true
}

/** Guess column mapping — tuned for Hotjar survey exports, works for similar CSVs. */
export function suggestCsvMapping(headers: string[]): CsvImportMapping {
  const lower = new Map(headers.map(h => [h.toLowerCase(), h]))
  const pick = (...names: string[]) => {
    for (const name of names) {
      const hit = lower.get(name.toLowerCase())
      if (hit) return hit
    }
    return ''
  }

  const questionHeaders = headers.filter(isQuestionHeader)

  return {
    score: questionHeaders[0] || pick('score', 'rating', 'csat'),
    comment: questionHeaders[1] || pick('comment', 'feedback', 'follow up', 'follow-up'),
    date: pick('Date Submitted', 'date', 'created at', 'submitted at', 'timestamp'),
    url: pick('Source URL', 'url', 'page', 'page url', 'path'),
    device: pick('Device', 'device type'),
    visitor: pick('Hotjar User ID', 'User', 'visitor', 'visitor id', 'user id'),
  }
}

export function isHotjarExport(headers: string[]) {
  return headers.includes('Date Submitted')
    && headers.includes('Source URL')
    && (headers.includes('Hotjar User ID') || headers.includes('Response URL'))
}

export function normalizeDevice(value: string): 'mobile' | 'tablet' | 'desktop' | null {
  const v = value.trim().toLowerCase()
  if (!v) return null
  if (v === 'phone' || v === 'mobile' || v.includes('mobile') || v.includes('phone')) return 'mobile'
  if (v === 'tablet' || v.includes('tablet')) return 'tablet'
  if (v === 'desktop' || v.includes('desktop') || v.includes('laptop')) return 'desktop'
  return null
}

export function parseImportDate(value: string): number | null {
  const raw = value.trim()
  if (!raw) return null
  // Hotjar: "2026-10-03 18:06:56"
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const ms = Date.parse(normalized)
  if (Number.isFinite(ms)) return ms
  const fallback = Date.parse(raw)
  return Number.isFinite(fallback) ? fallback : null
}

export function parseScore(value: string, type: 'csat' | 'thumbs' | 'helpful'): number | null {
  const raw = value.trim()
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  if (type === 'thumbs') {
    if (n === 0 || n === 1) return n
    return null
  }
  if (type === 'helpful') {
    if (n >= 1 && n <= 4 && Number.isInteger(n)) return n
    return null
  }
  if (n >= 1 && n <= 5 && Number.isInteger(n)) return n
  return null
}

export function splitUrl(value: string): { host: string, path: string } {
  const raw = value.trim()
  if (!raw) return { host: '', path: '/' }
  try {
    const u = new URL(raw)
    return {
      host: u.host.slice(0, 255),
      path: (u.pathname || '/').slice(0, 2048) || '/',
    }
  }
  catch {
    if (raw.startsWith('/')) return { host: '', path: raw.split('?')[0]!.slice(0, 2048) }
    return { host: '', path: '/' }
  }
}
