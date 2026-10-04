import { getProjectOrThrow, toProjectDto } from '../../../../utils/projects'
import { requireAdminSession } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing project id' })
  }
  return { project: toProjectDto(getProjectOrThrow(id)) }
})
