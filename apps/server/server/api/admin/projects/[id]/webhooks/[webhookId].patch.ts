import * as v from 'valibot'
import { WebhookPatchSchema } from '../../../../../../shared/webhooks'
import { requireAdminSession } from '../../../../../utils/auth'
import { updateWebhook } from '../../../../../utils/webhooks'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  const webhookId = getRouterParam(event, 'webhookId')
  if (!id || !webhookId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing webhook id' })
  }
  const body = await readValidatedBody(event, data => v.parse(WebhookPatchSchema, data))
  return { webhook: updateWebhook(id, webhookId, body) }
})
