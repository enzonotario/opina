import { eq } from 'drizzle-orm'
import * as v from 'valibot'
import { ProjectUpdateSchema } from '../../../../../shared/projects'
import { projects } from '../../../../db/schema'
import { useDb } from '../../../../db/client'
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

  const body = await readValidatedBody(event, data =>
    v.parse(ProjectUpdateSchema, data),
  )

  const existing = getProjectOrThrow(id)
  const patch: Partial<typeof projects.$inferInsert> = {
    updatedAt: Date.now(),
  }

  if (body.name !== undefined) patch.name = body.name
  if (body.allowedOrigins !== undefined) {
    patch.allowedOrigins = JSON.stringify(body.allowedOrigins)
  }
  if (body.settings !== undefined) {
    patch.settings = JSON.stringify({
      ...JSON.parse(existing.settings || '{}'),
      ...body.settings,
    })
  }

  useDb()
    .update(projects)
    .set(patch)
    .where(eq(projects.id, id))
    .run()

  return { project: toProjectDto(getProjectOrThrow(id)) }
})
