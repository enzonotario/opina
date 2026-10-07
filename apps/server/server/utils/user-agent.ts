/** Lightweight UA → Hotjar-ish browser/OS labels (no dependency). */

export function parseUserAgent(ua: string | undefined | null): {
  browser?: string
  os?: string
} {
  if (!ua) return {}
  const browser = detectBrowser(ua)
  const os = detectOs(ua)
  return {
    ...(browser ? { browser } : {}),
    ...(os ? { os } : {}),
  }
}

function detectBrowser(ua: string): string | undefined {
  // Order matters: Edge/Opera/Chrome share Chromium tokens.
  const edge = ua.match(/Edg(?:e|A|iOS)?\/(\d+(?:\.\d+)?)/)
  if (edge) return `Edge ${edge[1]}`

  const opera = ua.match(/(?:OPR|Opera)\/(\d+(?:\.\d+)?)/)
  if (opera) return `Opera ${opera[1]}`

  const chrome = ua.match(/(?:Chrome|CriOS)\/(\d+(?:\.\d+)?)/)
  if (chrome && !/Chromium/.test(ua)) return `Chrome ${chrome[1]}`

  const firefox = ua.match(/(?:Firefox|FxiOS)\/(\d+(?:\.\d+)?)/)
  if (firefox) return `Firefox ${firefox[1]}`

  const safari = ua.match(/Version\/(\d+(?:\.\d+)?).*Safari/)
  if (safari && !chrome) return `Safari ${safari[1]}`

  const ie = ua.match(/(?:MSIE |rv:)(\d+(?:\.\d+)?)/)
  if (ie) return `IE ${ie[1]}`

  return undefined
}

function detectOs(ua: string): string | undefined {
  if (/Android/i.test(ua)) {
    const m = ua.match(/Android (\d+(?:\.\d+)?)/)
    return m ? `Android ${m[1]}` : 'Android'
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    const m = ua.match(/OS (\d+)[_.](\d+)/)
    return m ? `iOS ${m[1]}.${m[2]}` : 'iOS'
  }
  if (/Windows NT 10/i.test(ua)) return 'Windows'
  if (/Windows NT 6\.3/i.test(ua)) return 'Windows 8.1'
  if (/Windows NT 6\.2/i.test(ua)) return 'Windows 8'
  if (/Windows NT 6\.1/i.test(ua)) return 'Windows 7'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac OS X/i.test(ua)) {
    const m = ua.match(/Mac OS X (\d+)[_.](\d+)/)
    return m ? `macOS ${m[1]}.${m[2]}` : 'macOS'
  }
  if (/CrOS/i.test(ua)) return 'Chrome OS'
  if (/Linux/i.test(ua)) return 'Linux'
  return undefined
}
