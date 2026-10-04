import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  backupDatabase as driverBackup,
  createDb,
  openSqlite,
  runMigrations as driverMigrate,
  type DbClient,
  type SqliteClient,
} from '#opina-db-driver'
import * as schema from './schema'

let _db: DbClient | null = null
let _sqlite: SqliteClient | null = null

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
  _sqlite = openSqlite(dbPath)
  return _sqlite
}

export function useDb() {
  if (_db) return _db
  _db = createDb(getSqlite(), schema)
  return _db
}

export function runMigrations(migrationsFolder: string) {
  driverMigrate(useDb(), migrationsFolder)
}

export async function backupDatabase(destPath: string) {
  await driverBackup(getSqlite(), destPath)
}

export { schema }
