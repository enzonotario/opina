import { describe, expect, it } from 'vitest'
import { isWeakSessionPassword } from '../server/utils/env-check'

describe('isWeakSessionPassword', () => {
  it('rejects short passwords', () => {
    expect(isWeakSessionPassword('short')).toBe(true)
  })

  it('rejects example defaults', () => {
    expect(isWeakSessionPassword('change-me-to-a-random-32-char-secret!!')).toBe(true)
    expect(isWeakSessionPassword('dev-only-change-me-32chars-min!!xx')).toBe(true)
  })

  it('accepts a long random secret', () => {
    expect(isWeakSessionPassword('xK9mP2vL8qR4nT7wY1zB6cD0eF3gH5jA')).toBe(false)
  })
})
