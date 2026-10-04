import { describe, expect, it, beforeEach } from 'vitest'
import {
  consumeLoginRateLimit,
  consumeRateLimit,
  resetRateLimitForTests,
} from '../server/utils/rate-limit'

describe('consumeRateLimit', () => {
  beforeEach(() => {
    resetRateLimitForTests()
  })

  it('allows up to the configured capacity', () => {
    const key = 'test:bucket'
    let allowed = 0
    for (let i = 0; i < 40; i++) {
      if (consumeRateLimit(key)) allowed++
    }
    expect(allowed).toBe(Number(process.env.OPINA_RATE_LIMIT_PER_MIN || 30))
  })
})

describe('consumeLoginRateLimit', () => {
  beforeEach(() => {
    resetRateLimitForTests()
  })

  it('is stricter than the public API bucket', () => {
    const key = '1.2.3.4'
    let allowed = 0
    for (let i = 0; i < 20; i++) {
      if (consumeLoginRateLimit(key)) allowed++
    }
    expect(allowed).toBe(Number(process.env.OPINA_LOGIN_RATE_LIMIT_PER_MIN || 10))
  })
})
