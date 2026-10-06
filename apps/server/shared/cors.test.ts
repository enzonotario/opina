import { describe, expect, it } from 'vitest'
import { isOriginAllowed } from './origin'

describe('isOriginAllowed', () => {
  it('rejects missing origin', () => {
    expect(isOriginAllowed(null, ['https://a.com'])).toBe(false)
  })

  it('allows exact origin match', () => {
    expect(isOriginAllowed('https://a.com', ['https://a.com'])).toBe(true)
    expect(isOriginAllowed('https://a.com', ['https://a.com/'])).toBe(true)
  })

  it('rejects other origins', () => {
    expect(isOriginAllowed('https://evil.com', ['https://a.com'])).toBe(false)
  })

  it('allows localhost / 127.0.0.1 on any port for local embeds', () => {
    expect(isOriginAllowed('http://localhost:3002', ['https://comparadolar.ar'])).toBe(true)
    expect(isOriginAllowed('http://127.0.0.1:3002', [])).toBe(true)
  })

  it('still rejects non-local origins not in the list', () => {
    expect(isOriginAllowed('https://evil.com', ['https://comparadolar.ar'])).toBe(false)
  })
})


