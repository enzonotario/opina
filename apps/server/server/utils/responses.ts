import { and, desc, eq, gte, isNotNull, lte, sql } from 'drizzle-orm'
import { responses } from '../db/schema'
import { useDb } from '../db/client'
import { getProjectOrThrow } from './projects'

export type ResponseFilters = {
  surveyId?: string
  from?: number
  to?: number
  scoreMin?: number
  scoreMax?: number
  path?: string
  hasComment?: boolean
  q?: string
  limit?: number
  offset?: number
}

export type ResponseDto = {
  id: string
  projectId: string
  surveyId: string
  score: number | null
  comment: string | null
  urlPath: string
  urlHost: string
  locale: string | null
  device: string | null
  visitorId: string
  metadata: Record<string, unknown>
  screenshotPath: string | null
  createdAt: number
}

function parseMeta(value: string) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

export function listResponses(projectId: string, filters: ResponseFilters = {}) {
  getProjectOrThrow(projectId)
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
  const offset = Math.max(filters.offset ?? 0, 0)

  const conditions = [eq(responses.projectId, projectId)]
  if (filters.surveyId) conditions.push(eq(responses.surveyId, filters.surveyId))
  if (filters.from != null) conditions.push(gte(responses.createdAt, filters.from))
  if (filters.to != null) conditions.push(lte(responses.createdAt, filters.to))
  if (filters.scoreMin != null) conditions.push(gte(responses.score, filters.scoreMin))
  if (filters.scoreMax != null) conditions.push(lte(responses.score, filters.scoreMax))
  if (filters.path) conditions.push(sql`${responses.urlPath} like ${`%${filters.path}%`}`)
  if (filters.hasComment === true) {
    conditions.push(isNotNull(responses.comment))
    conditions.push(sql`trim(${responses.comment}) != ''`)
  }
  if (filters.hasComment === false) {
    conditions.push(sql`(${responses.comment} is null or trim(${responses.comment}) = '')`)
  }
  if (filters.q) {
    conditions.push(sql`${responses.comment} like ${`%${filters.q}%`}`)
  }

  const where = and(...conditions)
  const db = useDb()
  const totalRow = db
    .select({ count: sql<number>`count(*)` })
    .from(responses)
    .where(where)
    .get()

  const rows = db
    .select()
    .from(responses)
    .where(where)
    .orderBy(desc(responses.createdAt))
    .limit(limit)
    .offset(offset)
    .all()

  return {
    total: Number(totalRow?.count || 0),
    limit,
    offset,
    items: rows.map((row): ResponseDto => ({
      id: row.id,
      projectId: row.projectId,
      surveyId: row.surveyId,
      score: row.score,
      comment: row.comment,
      urlPath: row.urlPath,
      urlHost: row.urlHost,
      locale: row.locale,
      device: row.device,
      visitorId: row.visitorId,
      metadata: parseMeta(row.metadata),
      screenshotPath: row.screenshotPath || null,
      createdAt: row.createdAt,
    })),
  }
}

export function exportResponses(projectId: string, format: 'csv' | 'json', filters: ResponseFilters = {}) {
  const data = listResponses(projectId, { ...filters, limit: 10_000, offset: 0 })
  if (format === 'json') {
    return {
      contentType: 'application/json; charset=utf-8',
      filename: `opina-${projectId}-responses.json`,
      body: JSON.stringify(data.items, null, 2),
    }
  }

  const headers = [
    'id', 'surveyId', 'score', 'comment', 'urlPath', 'urlHost',
    'locale', 'device', 'visitorId', 'screenshotPath', 'createdAt',
  ]
  const escape = (value: unknown) => {
    const str = value == null ? '' : String(value)
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
    return str
  }
  const lines = [
    headers.join(','),
    ...data.items.map(item => headers.map(h => escape((item as Record<string, unknown>)[h])).join(',')),
  ]
  return {
    contentType: 'text/csv; charset=utf-8',
    filename: `opina-${projectId}-responses.csv`,
    body: lines.join('\n'),
  }
}
