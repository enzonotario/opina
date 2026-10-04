import { mkdirSync, writeFileSync, existsSync, unlinkSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { responses } from '../db/schema'
import { useDb } from '../db/client'

const MAX_BYTES = 450 * 1024

function dataDir() {
  try {
    return String(useRuntimeConfig().opinaDataDir || './data')
  } catch {
    return process.env.OPINA_DATA_DIR || './data'
  }
}

export function screenshotsDir() {
  const dir = join(dataDir(), 'screenshots')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function saveScreenshotJpeg(responseId: string, dataUrl: string) {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim())
  if (!match) {
    throw createError({ statusCode: 400, statusMessage: 'Expected JPEG data URL' })
  }
  const buf = Buffer.from(match[1]!.replace(/\s/g, ''), 'base64')
  if (buf.length < 100) {
    throw createError({ statusCode: 400, statusMessage: 'Screenshot too small' })
  }
  if (buf.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Screenshot too large' })
  }

  const relative = `screenshots/${responseId}.jpg`
  const abs = join(dataDir(), relative)
  mkdirSync(join(dataDir(), 'screenshots'), { recursive: true })
  writeFileSync(abs, buf)

  useDb().update(responses)
    .set({ screenshotPath: relative })
    .where(eq(responses.id, responseId))
    .run()

  return relative
}

export function readScreenshot(relativePath: string): Buffer | null {
  if (!relativePath.startsWith('screenshots/') || relativePath.includes('..')) {
    return null
  }
  const abs = join(dataDir(), relativePath)
  if (!existsSync(abs)) return null
  return readFileSync(abs)
}

export function deleteScreenshot(relativePath: string | null | undefined) {
  if (!relativePath) return
  if (!relativePath.startsWith('screenshots/') || relativePath.includes('..')) return
  const abs = join(dataDir(), relativePath)
  if (existsSync(abs)) {
    try {
      unlinkSync(abs)
    } catch { /* ignore */ }
  }
}
