import { and, count, eq, gte } from 'drizzle-orm'
import { responses } from '../db/schema'
import { useDb } from '../db/client'

const DEFAULT_MAX = 10

export function maxResponsesPerVisitorDay() {
  const n = Number(process.env.OPINA_MAX_RESPONSES_PER_VISITOR_DAY || DEFAULT_MAX)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX
}

export function utcDayStart(now = Date.now()) {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function isVisitorDailyCapReached(surveyId: string, visitorId: string) {
  const since = utcDayStart()
  const row = useDb()
    .select({ c: count() })
    .from(responses)
    .where(and(
      eq(responses.surveyId, surveyId),
      eq(responses.visitorId, visitorId),
      gte(responses.createdAt, since),
    ))
    .get()
  return Number(row?.c || 0) >= maxResponsesPerVisitorDay()
}
