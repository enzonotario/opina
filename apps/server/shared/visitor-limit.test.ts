import { describe, expect, it } from 'vitest'
import { utcDayStart } from '../server/utils/visitor-limit'

describe('utcDayStart', () => {
  it('returns midnight UTC for a known timestamp', () => {
    // 2026-10-03 15:30:00 UTC
    const ts = Date.UTC(2026, 9, 3, 15, 30, 0)
    expect(utcDayStart(ts)).toBe(Date.UTC(2026, 9, 3))
  })
})
