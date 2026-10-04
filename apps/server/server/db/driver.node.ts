import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type * as schema from './schema'

export type SqliteClient = Database.Database
export type DbClient = ReturnType<typeof drizzle<typeof schema>>

export function openSqlite(dbPath: string): SqliteClient {
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  return sqlite
}

export function createDb(sqlite: SqliteClient, schemaModule: typeof schema): DbClient {
  return drizzle(sqlite, { schema: schemaModule })
}

export function runMigrations(db: DbClient, migrationsFolder: string) {
  migrate(db, { migrationsFolder })
}

export async function backupDatabase(sqlite: SqliteClient, destPath: string) {
  await sqlite.backup(destPath)
}
