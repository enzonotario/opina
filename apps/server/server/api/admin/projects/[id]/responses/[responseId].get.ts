import { requireAdminSession } from '../../../../../utils/auth'
import { getResponse } from '../../../../../utils/responses'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  const responseId = getRouterParam(event, 'responseId')
  if (!id || !responseId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ids' })
  }
  return getResponse(id, responseId)
})
