import { requireAdminSession } from '../../../utils/auth'
import { revokeAccessToken } from '../../../utils/access-tokens'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing token id' })
  return revokeAccessToken(id)
})
