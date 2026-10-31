import * as v from 'valibot'
import { requireAdminSession } from '../../../../../utils/auth'
import { updateResponse } from '../../../../../utils/responses'

const BodySchema = v.object({
  resolved: v.optional(v.boolean()),
  adminNote: v.optional(v.nullable(v.string())),
})

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  const responseId = getRouterParam(event, 'responseId')
  if (!id || !responseId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ids' })
  }

  const body = await readValidatedBody(event, data => v.parse(BodySchema, data))
  if (body.resolved === undefined && body.adminNote === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  return updateResponse(id, responseId, body)
})
