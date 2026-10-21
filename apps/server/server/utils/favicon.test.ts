import { describe, expect, it } from 'vitest'
import { fallbackFavicon, pickIconHref } from './favicon'

const page = 'https://comparatasas.ar/fondos'

describe('pickIconHref', () => {
  it('prefers a larger touch icon over a small favicon', () => {
    const html = `
      <link rel="apple-touch-icon" href="/icons/icon-192x192.png">
      <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
      <link rel="icon" href="/favicon.ico">
    `
    expect(pickIconHref(html, page)).toBe('https://comparatasas.ar/icons/icon-192x192.png')
  })

  it('resolves a relative shortcut icon', () => {
    const html = `<link rel="shortcut icon" href="img/favicon.ico">`
    expect(pickIconHref(html, page)).toBe('https://comparatasas.ar/img/favicon.ico')
  })

  it('falls back to the origin favicon', () => {
    expect(pickIconHref('<html></html>', page)).toBeNull()
    expect(fallbackFavicon(page)).toBe('https://comparatasas.ar/favicon.ico')
  })
})
