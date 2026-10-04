import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _sqlite: Database.Database | null = null

function resolveDataDir() {
  try {
    const config = useRuntimeConfig()
    return config.opinaDataDir || process.env.OPINA_DATA_DIR || './data'
  } catch {
    return process.env.OPINA_DATA_DIR || './data'
  }
}

export function getSqlite() {
  if (_sqlite) return _sqlite

  const dataDir = resolveDataDir()
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(join(dataDir, 'tmp'), { recursive: true })

  const dbPath = join(dataDir, 'opina.db')
  _sqlite = new Database(dbPath)
  _sqlite.pragma('journal_mode = WAL')
  _sqlite.pragma('synchronous = NORMAL')
  _sqlite.pragma('foreign_keys = ON')
  _sqlite.pragma('busy_timeout = 5000')

  return _sqlite
}

export function useDb() {
  if (_db) return _db
  _db = drizzle(getSqlite(), { schema })
  return _db
}

export { schema }
