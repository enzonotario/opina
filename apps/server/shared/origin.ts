function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

export function isOriginAllowed(origin: string | null, allowed: string[]) {
  if (!origin) return false
  try {
    const got = new URL(origin)
    // Local embeds (Nuxt/Vite on any port) during development.
    if (isLocalHostname(got.hostname)) return true
  }
  catch {
    /* fall through */
  }
  return allowed.some((entry) => {
    try {
      return new URL(entry).origin === new URL(origin).origin
    }
    catch {
      return entry === origin
    }
  })
}
