import { requireAdminSession } from '../../utils/auth'
import { getAccountStats } from '../../utils/stats'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const query = getQuery(event)
  const days = Math.min(Math.max(Number(query.days) || 30, 1), 365)
  return { stats: getAccountStats(days) }
})
