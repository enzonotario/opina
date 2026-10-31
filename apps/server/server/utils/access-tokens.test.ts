import { createHash, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'

/** Mirror of hash used by access-tokens (pure, no DB). */
function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

describe('access token format', () => {
  it('hashes consistently', () => {
    const token = `opina_pat_${randomBytes(24).toString('base64url')}`
    expect(hashToken(token)).toBe(hashToken(token))
    expect(hashToken(token)).not.toBe(hashToken(`${token}x`))
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/)
  })

  it('uses a stable prefix for display', () => {
    const secret = randomBytes(24).toString('base64url')
    const token = `opina_pat_${secret}`
    expect(token.startsWith('opina_pat_')).toBe(true)
    expect(token.slice(0, 18).length).toBe(18)
  })
})
