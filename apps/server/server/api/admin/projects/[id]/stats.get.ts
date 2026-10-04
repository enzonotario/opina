import { requireAdminSession } from '../../../../utils/auth'
import { getProjectStats } from '../../../../utils/stats'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing project id' })
  const query = getQuery(event)
  const days = Math.min(Math.max(Number(query.days) || 30, 1), 365)
  return { stats: getProjectStats(id, days) }
})
