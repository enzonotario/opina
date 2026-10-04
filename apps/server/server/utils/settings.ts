import { eq } from 'drizzle-orm'
import { settings } from '../db/schema'
import { useDb } from '../db/client'

export function getSetting(key: string): string | null {
  const row = useDb()
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get()
  return row?.value ?? null
}

export function setSetting(key: string, value: string) {
  const now = Date.now()
  const db = useDb()
  const existing = db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get()

  if (existing) {
    db.update(settings)
      .set({ value, updatedAt: now })
      .where(eq(settings.key, key))
      .run()
    return
  }

  db.insert(settings)
    .values({ key, value, updatedAt: now })
    .run()
}

export function deleteSetting(key: string) {
  useDb().delete(settings).where(eq(settings.key, key)).run()
}
