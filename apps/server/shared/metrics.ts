export type RatedScore = { score: number, scaleMax: number }

/** Top of the scale for surveys that feed CSAT. Thumbs stay on their own metric. */
export function scaleMaxFor(surveyType: string): number | null {
  if (surveyType === 'csat') return 5
  if (surveyType === 'helpful') return 4
  return null
}

/**
 * Satisfied = one of the two best boxes on that scale.
 * 1–5: 4 and 5. Page feedback 1–4: 3 and 4, so “Muy útil” (4) is 4/4, not 4/5.
 */
export function isCsatPositive(score: number, scaleMax: number): boolean {
  return score >= scaleMax - 1
}

export function csatPercent(scores: number[]): number | null {
  return csatPercentRated(scores.map(score => ({ score, scaleMax: 5 })))
}

export function csatPercentRated(scores: RatedScore[]): number | null {
  if (!scores.length) return null
  const good = scores.filter(s => isCsatPositive(s.score, s.scaleMax)).length
  return Math.round((good / scores.length) * 1000) / 10
}

/** Raw mean when every score shares a scale; otherwise mapped onto 1–5 (4/4 → 5). */
export function averageRated(scores: RatedScore[]): { average: number | null, scale: number | null } {
  if (!scores.length) return { average: null, scale: null }
  const scales = new Set(scores.map(s => s.scaleMax))
  if (scales.size === 1) {
    const scale = scores[0]!.scaleMax
    return { average: averageScore(scores.map(s => s.score)), scale }
  }
  const normalized = scores.map(s => 1 + ((s.score - 1) / (s.scaleMax - 1)) * 4)
  return { average: averageScore(normalized), scale: 5 }
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
