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

  it('treats localhost and 127.0.0.1 as distinct', () => {
    expect(isOriginAllowed('http://127.0.0.1:3001', ['http://localhost:3001'])).toBe(false)
    expect(isOriginAllowed('http://127.0.0.1:3001', ['http://127.0.0.1:3001'])).toBe(true)
  })
})
