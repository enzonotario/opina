import { randomBytes } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { users } from '../db/schema'
import { useDb } from '../db/client'
import { deleteSetting, getSetting, setSetting } from './settings'

const SETUP_TOKEN_KEY = 'setup_token'
const SETUP_TOKEN_EXPIRES_KEY = 'setup_token_expires_at'
const DEFAULT_TTL_MS = 30 * 60 * 1000 // 30 minutes

export function userCount() {
  const [{ count }] = useDb()
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .all()
  return Number(count)
}

export function needsSetup() {
  return userCount() === 0
}

function resolveDataDir() {
  try {
    const config = useRuntimeConfig()
    return config.opinaDataDir || process.env.OPINA_DATA_DIR || './data'
  } catch {
    return process.env.OPINA_DATA_DIR || './data'
  }
}

function writeSetupUrlFile(url: string) {
  const dataDir = resolveDataDir()
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(join(dataDir, 'setup-url.txt'), `${url}\n`, 'utf8')
}

export function clearSetupToken() {
  deleteSetting(SETUP_TOKEN_KEY)
  deleteSetting(SETUP_TOKEN_EXPIRES_KEY)
}

export function ensureSetupToken(): string | null {
  if (!needsSetup()) {
    clearSetupToken()
    return null
  }

  const envToken = process.env.OPINA_SETUP_TOKEN?.trim()
  const existing = getSetting(SETUP_TOKEN_KEY)
  const expiresAt = Number(getSetting(SETUP_TOKEN_EXPIRES_KEY) || 0)
  const stillValid = Boolean(existing && expiresAt > Date.now())

  if (envToken) {
    setSetting(SETUP_TOKEN_KEY, envToken)
    setSetting(SETUP_TOKEN_EXPIRES_KEY, String(Date.now() + DEFAULT_TTL_MS))
    return envToken
  }

  if (stillValid && existing) {
    return existing
  }

  const token = randomBytes(32).toString('hex')
  setSetting(SETUP_TOKEN_KEY, token)
  setSetting(SETUP_TOKEN_EXPIRES_KEY, String(Date.now() + DEFAULT_TTL_MS))
  return token
}

export function validateSetupToken(token: string): boolean {
  if (!needsSetup()) return false
  if (!token || token.length < 16) return false

  const expected = getSetting(SETUP_TOKEN_KEY)
  const expiresAt = Number(getSetting(SETUP_TOKEN_EXPIRES_KEY) || 0)
  if (!expected || expiresAt <= Date.now()) return false
  return token === expected
}

export function buildSetupUrl(token: string) {
  const config = useRuntimeConfig()
  const base = String(config.public.url || 'http://localhost:3000').replace(/\/$/, '')
  return `${base}/setup/${token}`
}

export function printSetupUrl() {
  const token = ensureSetupToken()
  if (!token) return

  const url = buildSetupUrl(token)
  writeSetupUrlFile(url)

  console.info('')
  console.info('(!) Open the URL below in the browser to create your first owner account:')
  console.info(url)
  console.info('(token expires in 30 minutes; restart the app to mint a new one)')
  console.info('')
}
