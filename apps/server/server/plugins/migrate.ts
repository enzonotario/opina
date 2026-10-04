import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { runMigrations } from '../db/client'

function resolveMigrationsFolder() {
  if (process.env.OPINA_MIGRATIONS_DIR) {
    return process.env.OPINA_MIGRATIONS_DIR
  }

  const candidates = [
    join(process.cwd(), 'server/db/migrations'),
    join(process.cwd(), 'migrations'),
    join(process.cwd(), '.output/server/migrations'),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  return candidates[0]!
}

export default defineNitroPlugin(() => {
  const migrationsFolder = resolveMigrationsFolder()
  runMigrations(migrationsFolder)
  console.info(`[opina] database migrations applied from ${migrationsFolder}`)
})
