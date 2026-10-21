import { requireAdminSession } from '../../../utils/auth'
import { resolveFavicon } from '../../../utils/favicon'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const url = String(getQuery(event).url || '')
  if (!url) {
    throw createError({ statusCode: 400, statusMessage: 'Missing url' })
  }
  const logoUrl = await resolveFavicon(url)
  return { logoUrl }
})
