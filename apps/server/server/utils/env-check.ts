const DEFAULT_MARKERS = [
  'change-me',
  'cambia-esto',
  'dev-only',
]

export function isWeakSessionPassword(password: string | undefined | null): boolean {
  const pw = String(password || '')
  if (pw.length < 32) return true
  const lower = pw.toLowerCase()
  return DEFAULT_MARKERS.some(m => lower.includes(m))
}

export function assertSessionPasswordSafe(options?: { exitOnFail?: boolean }) {
  const pw = process.env.NUXT_SESSION_PASSWORD
  const isProd = process.env.NODE_ENV === 'production'
  const allowInsecure = process.env.OPINA_ALLOW_INSECURE === '1'
  if (!isWeakSessionPassword(pw)) return

  const msg = '[opina] NUXT_SESSION_PASSWORD must be a random string of at least 32 characters (not the example default).'
  if (isProd && !allowInsecure) {
    console.error(msg)
    if (options?.exitOnFail !== false) {
      process.exit(1)
    }
    return
  }
  console.warn(`${msg} Allowed because ${isProd ? 'OPINA_ALLOW_INSECURE=1' : 'NODE_ENV is not production'}.`)
}
