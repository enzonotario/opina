import { Database } from 'bun:sqlite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _sqlite: Database | null = null

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
  _sqlite = new Database(dbPath, { create: true })
  _sqlite.exec('PRAGMA journal_mode = WAL')
  _sqlite.exec('PRAGMA synchronous = NORMAL')
  _sqlite.exec('PRAGMA foreign_keys = ON')
  _sqlite.exec('PRAGMA busy_timeout = 5000')

  return _sqlite
}

export function useDb() {
  if (_db) return _db
  _db = drizzle(getSqlite(), { schema })
  return _db
}

export function runMigrations(migrationsFolder: string) {
  migrate(useDb(), { migrationsFolder })
}

export async function backupDatabase(destPath: string) {
  const sqlite = getSqlite()
  sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  writeFileSync(destPath, sqlite.serialize())
}

export { schema }
