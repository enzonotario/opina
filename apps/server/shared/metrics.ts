export function csatPercent(scores: number[]): number | null {
  if (!scores.length) return null
  const good = scores.filter(s => s >= 4).length
  return Math.round((good / scores.length) * 1000) / 10
}

export function averageScore(scores: number[]): number | null {
  if (!scores.length) return null
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
}

export function npsScore(scores: number[]): number | null {
  if (!scores.length) return null
  const promoters = scores.filter(s => s >= 9).length
  const detractors = scores.filter(s => s <= 6).length
  return Math.round(((promoters - detractors) / scores.length) * 1000) / 10
}

export function thumbsPositivePercent(scores: number[]): number | null {
  if (!scores.length) return null
  const up = scores.filter(s => s === 1).length
  return Math.round((up / scores.length) * 1000) / 10
}

/** Glob-like path match: `*` = segment, `**` = any depth. */
export function matchPathPattern(pattern: string, path: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE::/g, '.*')
  return new RegExp(`^${escaped}$`).test(path)
}
