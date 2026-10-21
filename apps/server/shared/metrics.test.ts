import { describe, expect, it } from 'vitest'
import {
  averageRated,
  averageScore,
  csatPercent,
  csatPercentRated,
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

describe('csatPercentRated', () => {
  it('treats page feedback 4 as 4/4, and 3 as the other positive box', () => {
    expect(csatPercentRated([{ score: 4, scaleMax: 4 }])).toBe(100)
    expect(csatPercentRated([
      { score: 4, scaleMax: 4 },
      { score: 3, scaleMax: 4 },
      { score: 2, scaleMax: 4 },
      { score: 1, scaleMax: 4 },
    ])).toBe(50)
  })
  it('does not score a helpful 4 as 4/5', () => {
    expect(csatPercentRated([
      { score: 4, scaleMax: 4 },
      { score: 3, scaleMax: 5 },
    ])).toBe(50)
  })
})

describe('averageRated', () => {
  it('keeps a page-feedback average out of 4', () => {
    expect(averageRated([{ score: 4, scaleMax: 4 }])).toEqual({ average: 4, scale: 4 })
  })
  it('maps 4/4 onto 5 when mixed with a 5-point score', () => {
    expect(averageRated([
      { score: 5, scaleMax: 5 },
      { score: 4, scaleMax: 4 },
    ])).toEqual({ average: 5, scale: 5 })
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
