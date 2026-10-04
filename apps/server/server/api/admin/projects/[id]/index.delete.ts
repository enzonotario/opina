import { eq } from 'drizzle-orm'
import { projects } from '../../../../db/schema'
import { useDb } from '../../../../db/client'
import { getProjectOrThrow } from '../../../../utils/projects'
import { requireAdminSession } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing project id' })
  }

  getProjectOrThrow(id)
  useDb().delete(projects).where(eq(projects.id, id)).run()
  console.info(`[opina] project deleted id=${id}`)
  return { ok: true }
})
