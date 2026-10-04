import { describe, expect, it } from 'vitest'
import {
  averageScore,
  csatPercent,
  matchPathPattern,
  npsScore,
  thumbsPositivePercent,
} from './metrics'

describe('csatPercent', () => {
  it('returns null for empty', () => {
    expect(csatPercent([])).toBeNull()
  })
  it('counts 4–5 as positive', () => {
    expect(csatPercent([5, 4, 3, 2])).toBe(50)
  })
})

describe('averageScore', () => {
  it('averages to two decimals', () => {
    expect(averageScore([5, 4, 3])).toBe(4)
    expect(averageScore([5, 4])).toBe(4.5)
  })
})

describe('npsScore', () => {
  it('computes promoters minus detractors', () => {
    // 2 promoters (9,10), 1 detractor (6), 1 passive (8) → (50-25)=25
    expect(npsScore([10, 9, 8, 6])).toBe(25)
  })
})

describe('thumbsPositivePercent', () => {
  it('counts 1 as positive', () => {
    expect(thumbsPositivePercent([1, 1, 0, 0])).toBe(50)
  })
})

describe('matchPathPattern', () => {
  it('matches globs', () => {
    expect(matchPathPattern('/docs/**', '/docs/a/b')).toBe(true)
    expect(matchPathPattern('/api/*', '/api/foo')).toBe(true)
    expect(matchPathPattern('/api/*', '/api/foo/bar')).toBe(false)
    expect(matchPathPattern('/admin/**', '/docs')).toBe(false)
  })
})
