import * as v from 'valibot'
import { WebhookCreateSchema } from '../../../../../../shared/webhooks'
import { requireAdminSession } from '../../../../../utils/auth'
import { createWebhook } from '../../../../../utils/webhooks'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing project id' })
  const body = await readValidatedBody(event, data => v.parse(WebhookCreateSchema, data))
  return { webhook: createWebhook(id, body) }
})
