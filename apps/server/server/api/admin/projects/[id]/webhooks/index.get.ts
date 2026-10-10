import { requireAdminSession } from '../../../../../utils/auth'
import { listWebhooks } from '../../../../../utils/webhooks'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing project id' })
  return { webhooks: listWebhooks(id) }
})
