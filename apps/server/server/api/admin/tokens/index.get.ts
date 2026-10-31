import { requireAdminSession } from '../../../utils/auth'
import { listAccessTokens } from '../../../utils/access-tokens'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  return { tokens: listAccessTokens() }
})
