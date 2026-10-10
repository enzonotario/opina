import { requireAdminSession } from '../../../../../../utils/auth'
import { deleteWebhook } from '../../../../../../utils/webhooks'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  const webhookId = getRouterParam(event, 'webhookId')
  if (!id || !webhookId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing webhook id' })
  }
  deleteWebhook(id, webhookId)
  return { ok: true }
})
