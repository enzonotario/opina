import { describe, expect, it } from 'vitest'
import { parseUserAgent } from './user-agent'

describe('parseUserAgent', () => {
  it('parses Chrome on Linux', () => {
    expect(parseUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    )).toEqual({ browser: 'Chrome 129.0', os: 'Linux' })
  })

  it('parses Safari on iOS', () => {
    expect(parseUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    )).toEqual({ browser: 'Safari 17.5', os: 'iOS 17.5' })
  })

  it('parses Edge on Windows', () => {
    expect(parseUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
    )).toEqual({ browser: 'Edge 129.0', os: 'Windows' })
  })

  it('handles empty', () => {
    expect(parseUserAgent('')).toEqual({})
    expect(parseUserAgent(null)).toEqual({})
  })
})
