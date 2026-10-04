export function isOriginAllowed(origin: string | null, allowed: string[]) {
  if (!origin) return false
  return allowed.some((entry) => {
    try {
      return new URL(entry).origin === new URL(origin).origin
    } catch {
      return entry === origin
    }
  })
}
