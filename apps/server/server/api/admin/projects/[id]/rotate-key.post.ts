import { eq } from 'drizzle-orm'
import { projects } from '../../../../db/schema'
import { useDb } from '../../../../db/client'
import { createId } from '../../../../utils/ids'
import {
  getProjectOrThrow,
  toProjectDto,
} from '../../../../utils/projects'
import { requireAdminSession } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing project id' })
  }

  getProjectOrThrow(id)
  const publicKey = createId('pk')
  useDb()
    .update(projects)
    .set({ publicKey, updatedAt: Date.now() })
    .where(eq(projects.id, id))
    .run()

  return { project: toProjectDto(getProjectOrThrow(id)) }
})
