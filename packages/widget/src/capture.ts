import html2canvas from 'html2canvas'

export type OpinaCaptureFn = () => Promise<string | null>

async function capture(): Promise<string | null> {
  const width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
  const scale = Math.min(1, 1200 / Math.max(width, 1))
  const canvas = await html2canvas(document.documentElement, {
    logging: false,
    useCORS: true,
    allowTaint: true,
    scale,
    ignoreElements: (el) => {
      const id = (el as HTMLElement).id
      return id === 'opina-root'
    },
  })
  const MAX_DATA_URL = 550_000
  const HARD_MAX = 650_000
  let quality = 0.55
  let dataUrl = canvas.toDataURL('image/jpeg', quality)
  while (dataUrl.length > MAX_DATA_URL && quality > 0.25) {
    quality -= 0.1
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }
  return dataUrl.length > HARD_MAX ? null : dataUrl
}

declare global {
  interface Window {
    __opinaCapture?: OpinaCaptureFn
  }
}

window.__opinaCapture = capture
