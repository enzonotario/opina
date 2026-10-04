import { and, eq, gte, isNotNull, lt, sql } from 'drizzle-orm'
import { averageScore, csatPercent } from '../../shared/metrics'
import { responses, surveys } from '../db/schema'
import { useDb } from '../db/client'
import { getProjectOrThrow } from './projects'

export type ProjectStats = {
  from: number
  to: number
  previousFrom: number
  previousTo: number
  total: number
  previousTotal: number
  withComment: number
  csatPercent: number | null
  previousCsatPercent: number | null
  average: number | null
  distribution: Array<{ score: number, count: number }>
  thumbsPositivePercent: number | null
  daily: Array<{ day: string, count: number, avg: number | null, csatPercent: number | null }>
  worstPages: Array<{ path: string, count: number, csatPercent: number | null, average: number | null }>
  recentComments: Array<{
    id: string
    score: number | null
    comment: string
    urlPath: string
    createdAt: number
    surveyId: string
  }>
}

function dayKey(ms: number) {
  return new Date(ms).toISOString().slice(0, 10)
}

export function getProjectStats(projectId: string, days = 30): ProjectStats {
  getProjectOrThrow(projectId)
  const to = Date.now()
  const from = to - days * 86400000
  const previousTo = from
  const previousFrom = previousTo - days * 86400000

  const db = useDb()
  const rows = db
    .select({
      id: responses.id,
      score: responses.score,
      comment: responses.comment,
      urlPath: responses.urlPath,
      createdAt: responses.createdAt,
      surveyId: responses.surveyId,
      surveyType: surveys.type,
    })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(and(
      eq(responses.projectId, projectId),
      gte(responses.createdAt, previousFrom),
      lt(responses.createdAt, to),
    ))
    .all()

  const current = rows.filter(r => r.createdAt >= from)
  const previous = rows.filter(r => r.createdAt < from)

  const currentCsat = current.filter(r => r.surveyType === 'csat' && r.score != null).map(r => r.score!)
  const previousCsat = previous.filter(r => r.surveyType === 'csat' && r.score != null).map(r => r.score!)
  const thumbs = current.filter(r => r.surveyType === 'thumbs' && r.score != null)
  const thumbsPositive = thumbs.filter(r => r.score === 1).length

  const distMap = new Map<number, number>()
  for (let i = 1; i <= 5; i++) distMap.set(i, 0)
  for (const s of currentCsat) distMap.set(s, (distMap.get(s) || 0) + 1)

  const byDay = new Map<string, number[]>()
  for (let i = 0; i < days; i++) {
    const d = dayKey(from + i * 86400000 + 12 * 3600000)
    byDay.set(d, [])
  }
  for (const r of current) {
    if (r.score == null || r.surveyType !== 'csat') continue
    const key = dayKey(r.createdAt)
    const list = byDay.get(key)
    if (list) list.push(r.score)
  }

  const pageMap = new Map<string, number[]>()
  for (const r of current) {
    if (r.score == null || r.surveyType !== 'csat') continue
    const list = pageMap.get(r.urlPath) || []
    list.push(r.score)
    pageMap.set(r.urlPath, list)
  }

  const worstPages = [...pageMap.entries()]
    .filter(([, scores]) => scores.length >= 3)
    .map(([path, scores]) => ({
      path,
      count: scores.length,
      csatPercent: csatPercent(scores),
      average: averageScore(scores),
    }))
    .sort((a, b) => (a.csatPercent ?? 100) - (b.csatPercent ?? 100))
    .slice(0, 10)

  const recentComments = db
    .select({
      id: responses.id,
      score: responses.score,
      comment: responses.comment,
      urlPath: responses.urlPath,
      createdAt: responses.createdAt,
      surveyId: responses.surveyId,
    })
    .from(responses)
    .where(and(
      eq(responses.projectId, projectId),
      gte(responses.createdAt, from),
      isNotNull(responses.comment),
      sql`trim(${responses.comment}) != ''`,
    ))
    .all()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20)
    .map(r => ({
      id: r.id,
      score: r.score,
      comment: r.comment || '',
      urlPath: r.urlPath,
      createdAt: r.createdAt,
      surveyId: r.surveyId,
    }))

  return {
    from,
    to,
    previousFrom,
    previousTo,
    total: current.length,
    previousTotal: previous.length,
    withComment: current.filter(r => r.comment && r.comment.trim()).length,
    csatPercent: csatPercent(currentCsat),
    previousCsatPercent: csatPercent(previousCsat),
    average: averageScore(currentCsat),
    distribution: [...distMap.entries()].map(([score, count]) => ({ score, count })),
    thumbsPositivePercent: thumbs.length
      ? Math.round((thumbsPositive / thumbs.length) * 1000) / 10
      : null,
    daily: [...byDay.entries()].map(([day, scores]) => ({
      day,
      count: scores.length,
      avg: averageScore(scores),
      csatPercent: csatPercent(scores),
    })),
    worstPages,
    recentComments,
  }
}

export function getProjectsSummary(days = 30) {
  const to = Date.now()
  const from = to - days * 86400000
  const db = useDb()
  const rows = db
    .select({
      projectId: responses.projectId,
      score: responses.score,
      surveyType: surveys.type,
    })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(gte(responses.createdAt, from))
    .all()

  const map = new Map<string, { total: number, csat: number[] }>()
  for (const r of rows) {
    const entry = map.get(r.projectId) || { total: 0, csat: [] }
    entry.total += 1
    if (r.surveyType === 'csat' && r.score != null) entry.csat.push(r.score)
    map.set(r.projectId, entry)
  }

  const out: Record<string, { total: number, csatPercent: number | null }> = {}
  for (const [id, entry] of map) {
    out[id] = {
      total: entry.total,
      csatPercent: csatPercent(entry.csat),
    }
  }
  return out
}
