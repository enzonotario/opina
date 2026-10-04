const PANEL_CSP = [
  'default-src \'self\'',
  'script-src \'self\' \'unsafe-inline\'',
  'style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com',
  'img-src \'self\' data: blob:',
  'font-src \'self\' https://fonts.gstatic.com data:',
  'connect-src \'self\'',
  'frame-ancestors \'self\'',
  'base-uri \'self\'',
  'form-action \'self\'',
].join('; ')

export default defineEventHandler((event) => {
  const path = event.path || ''
  if (path.startsWith('/api/v1/widget')) return

  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setResponseHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  setResponseHeader(event, 'X-Frame-Options', 'SAMEORIGIN')

  if (path.startsWith('/api/')) return

  setResponseHeader(event, 'Content-Security-Policy', PANEL_CSP)

  if ((process.env.NUXT_PUBLIC_URL || '').startsWith('https://')) {
    setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
})
