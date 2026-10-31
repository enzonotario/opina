import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm'
import { responses } from '../db/schema'
import { useDb } from '../db/client'
import { getProjectOrThrow } from './projects'
import { deleteScreenshot } from './screenshots'

export type ResponseFilters = {
  surveyId?: string
  from?: number
  to?: number
  scoreMin?: number
  scoreMax?: number
  /** Exact score match for one or many reactions (e.g. CSAT 1+2). */
  scores?: number[]
  path?: string
  hasComment?: boolean
  resolved?: boolean
  q?: string
  limit?: number
  offset?: number
}

/** Parse `scores=1,2` or `scores=1&scores=2` query values. */
export function parseScoreList(raw: unknown): number[] | undefined {
  if (raw == null || raw === '') return undefined
  const parts = Array.isArray(raw)
    ? raw.flatMap(v => String(v).split(','))
    : String(raw).split(',')
  const scores = [...new Set(
    parts
      .map(s => Number(s.trim()))
      .filter(n => Number.isFinite(n)),
  )]
  return scores.length ? scores : undefined
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
  resolved: boolean
  autoResolved: boolean
  resolvedAt: number | null
  adminNote: string | null
  createdAt: number
}

export type ResponsePatchInput = {
  resolved?: boolean
  adminNote?: string | null
}

const ADMIN_NOTE_MAX = 4000

/** Initial resolution flags when creating a response from a comment. */
export function resolutionFromComment(comment: string | null | undefined, at: number) {
  const hasComment = !!(comment && comment.trim())
  if (hasComment) {
    return { resolved: 0, autoResolved: 0, resolvedAt: null as number | null }
  }
  return { resolved: 1, autoResolved: 1, resolvedAt: at }
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

function toResponseDto(row: typeof responses.$inferSelect): ResponseDto {
  return {
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
    resolved: row.resolved === 1,
    autoResolved: row.autoResolved === 1,
    resolvedAt: row.resolvedAt ?? null,
    adminNote: row.adminNote || null,
    createdAt: row.createdAt,
  }
}

function normalizeAdminNote(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > ADMIN_NOTE_MAX) {
    throw createError({
      statusCode: 400,
      statusMessage: `adminNote max length is ${ADMIN_NOTE_MAX}`,
    })
  }
  return trimmed
}

export function getResponse(projectId: string, responseId: string): ResponseDto {
  getProjectOrThrow(projectId)
  const row = useDb()
    .select()
    .from(responses)
    .where(and(eq(responses.id, responseId), eq(responses.projectId, projectId)))
    .get()

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Response not found' })
  }
  return toResponseDto(row)
}

export function listResponses(projectId: string, filters: ResponseFilters = {}) {
  getProjectOrThrow(projectId)
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
  const offset = Math.max(filters.offset ?? 0, 0)

  const conditions = [eq(responses.projectId, projectId)]
  if (filters.surveyId) conditions.push(eq(responses.surveyId, filters.surveyId))
  if (filters.from != null) conditions.push(gte(responses.createdAt, filters.from))
  if (filters.to != null) conditions.push(lte(responses.createdAt, filters.to))
  if (filters.scores?.length) {
    conditions.push(inArray(responses.score, filters.scores))
  } else {
    if (filters.scoreMin != null) conditions.push(gte(responses.score, filters.scoreMin))
    if (filters.scoreMax != null) conditions.push(lte(responses.score, filters.scoreMax))
  }
  if (filters.path) conditions.push(sql`${responses.urlPath} like ${`%${filters.path}%`}`)
  if (filters.hasComment === true) {
    conditions.push(isNotNull(responses.comment))
    conditions.push(sql`trim(${responses.comment}) != ''`)
  }
  if (filters.hasComment === false) {
    conditions.push(sql`(${responses.comment} is null or trim(${responses.comment}) = '')`)
  }
  if (filters.resolved === true) conditions.push(eq(responses.resolved, 1))
  if (filters.resolved === false) conditions.push(eq(responses.resolved, 0))
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
    items: rows.map(toResponseDto),
  }
}

export function updateResponse(
  projectId: string,
  responseId: string,
  patch: ResponsePatchInput,
): ResponseDto {
  getResponse(projectId, responseId)

  const updates: Partial<typeof responses.$inferInsert> = {}

  if (patch.resolved !== undefined) {
    if (patch.resolved) {
      updates.resolved = 1
      updates.resolvedAt = Date.now()
    } else {
      updates.resolved = 0
      updates.resolvedAt = null
    }
  }

  if (patch.adminNote !== undefined) {
    updates.adminNote = normalizeAdminNote(patch.adminNote)
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  useDb()
    .update(responses)
    .set(updates)
    .where(and(eq(responses.id, responseId), eq(responses.projectId, projectId)))
    .run()

  return getResponse(projectId, responseId)
}

export function deleteResponse(projectId: string, responseId: string) {
  const row = getResponse(projectId, responseId)
  deleteScreenshot(row.screenshotPath)
  useDb().delete(responses).where(eq(responses.id, responseId)).run()
  return { ok: true as const }
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
    'locale', 'device', 'visitorId', 'screenshotPath',
    'resolved', 'autoResolved', 'resolvedAt', 'adminNote', 'createdAt',
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
