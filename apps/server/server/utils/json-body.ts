export function parseJsonBody(raw: string | undefined | null): unknown {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON' })
  }
}
