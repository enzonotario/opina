import { describe, expect, it } from 'vitest'
import { sanitizeClientMetadata } from './response-metadata'

describe('sanitizeClientMetadata', () => {
  it('keeps custom keys and valid resolution', () => {
    expect(sanitizeClientMetadata({
      plan: 'pro',
      resolution: '1920x1080',
      country: 'AR',
      browser: 'Chrome',
      imported: true,
    })).toEqual({
      plan: 'pro',
      resolution: '1920x1080',
    })
  })

  it('drops invalid resolution', () => {
    expect(sanitizeClientMetadata({ resolution: 'fullscreen' })).toEqual({})
  })
})
