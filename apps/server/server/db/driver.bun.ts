import { Database } from 'bun:sqlite'
import { writeFileSync } from 'node:fs'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import type * as schema from './schema'

export type SqliteClient = Database
export type DbClient = ReturnType<typeof drizzle<typeof schema>>

export function openSqlite(dbPath: string): SqliteClient {
  const sqlite = new Database(dbPath, { create: true })
  sqlite.exec('PRAGMA journal_mode = WAL')
  sqlite.exec('PRAGMA synchronous = NORMAL')
  sqlite.exec('PRAGMA foreign_keys = ON')
  sqlite.exec('PRAGMA busy_timeout = 5000')
  return sqlite
}

export function createDb(sqlite: SqliteClient, schemaModule: typeof schema): DbClient {
  return drizzle(sqlite, { schema: schemaModule })
}

export function runMigrations(db: DbClient, migrationsFolder: string) {
  migrate(db, { migrationsFolder })
}

export async function backupDatabase(sqlite: SqliteClient, destPath: string) {
  sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  writeFileSync(destPath, sqlite.serialize())
}
