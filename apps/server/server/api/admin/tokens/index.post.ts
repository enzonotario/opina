import * as v from 'valibot'
import { requireAdminSession } from '../../../utils/auth'
import { createAccessToken } from '../../../utils/access-tokens'

const BodySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
})

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const body = await readValidatedBody(event, data => v.parse(BodySchema, data))
  return { token: createAccessToken(body.name) }
})
