import { and, eq, gte, isNotNull, lt, sql } from 'drizzle-orm'
import { averageScore, csatPercent } from '../../shared/metrics'
import { projects, responses, surveys } from '../db/schema'
import { useDb } from '../db/client'
import { getProjectOrThrow, listProjects } from './projects'

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
  helpfulDistribution: Array<{ score: number, count: number }>
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
  const helpfulScores = current.filter(r => r.surveyType === 'helpful' && r.score != null).map(r => r.score!)

  const distMap = new Map<number, number>()
  for (let i = 1; i <= 5; i++) distMap.set(i, 0)
  for (const s of currentCsat) distMap.set(s, (distMap.get(s) || 0) + 1)

  const helpfulDistMap = new Map<number, number>()
  for (let i = 1; i <= 4; i++) helpfulDistMap.set(i, 0)
  for (const s of helpfulScores) {
    if (s >= 1 && s <= 4) helpfulDistMap.set(s, (helpfulDistMap.get(s) || 0) + 1)
  }

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
    helpfulDistribution: [...helpfulDistMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([score, count]) => ({ score, count })),
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

export type AccountDailyPoint = {
  day: string
  count: number
  avg: number | null
  csatPercent: number | null
}

export type AccountStats = Omit<ProjectStats, 'recentComments' | 'worstPages'> & {
  projectCount: number
  projects: Array<{
    id: string
    name: string
    total: number
    csatPercent: number | null
  }>
  dailyByProject: Array<{
    projectId: string
    projectName: string
    daily: AccountDailyPoint[]
  }>
  recentComments: Array<{
    id: string
    score: number | null
    comment: string
    urlPath: string
    createdAt: number
    surveyId: string
    projectId: string
    projectName: string
  }>
  worstPages: Array<{
    path: string
    count: number
    csatPercent: number | null
    average: number | null
    projectId: string
    projectName: string
  }>
}

export function getAccountStats(days = 30): AccountStats {
  const to = Date.now()
  const from = to - days * 86400000
  const previousTo = from
  const previousFrom = previousTo - days * 86400000
  const allProjects = listProjects()
  const nameById = new Map(allProjects.map(p => [p.id, p.name]))

  const db = useDb()
  const rows = db
    .select({
      id: responses.id,
      projectId: responses.projectId,
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
  const helpfulScores = current.filter(r => r.surveyType === 'helpful' && r.score != null).map(r => r.score!)

  const distMap = new Map<number, number>()
  for (let i = 1; i <= 5; i++) distMap.set(i, 0)
  for (const s of currentCsat) distMap.set(s, (distMap.get(s) || 0) + 1)

  const helpfulDistMap = new Map<number, number>()
  for (let i = 1; i <= 4; i++) helpfulDistMap.set(i, 0)
  for (const s of helpfulScores) {
    if (s >= 1 && s <= 4) helpfulDistMap.set(s, (helpfulDistMap.get(s) || 0) + 1)
  }

  const dayKeys: string[] = []
  for (let i = 0; i < days; i++) {
    dayKeys.push(dayKey(from + i * 86400000 + 12 * 3600000))
  }

  const byDay = new Map<string, number[]>()
  const byDayProject = new Map<string, Map<string, number[]>>()
  for (const d of dayKeys) {
    byDay.set(d, [])
    byDayProject.set(d, new Map())
  }
  for (const r of current) {
    if (r.score == null || r.surveyType !== 'csat') continue
    const key = dayKey(r.createdAt)
    const list = byDay.get(key)
    if (list) list.push(r.score)
    const projectMap = byDayProject.get(key)
    if (projectMap) {
      const scores = projectMap.get(r.projectId) || []
      scores.push(r.score)
      projectMap.set(r.projectId, scores)
    }
  }

  const pageMap = new Map<string, { projectId: string, scores: number[] }>()
  for (const r of current) {
    if (r.score == null || r.surveyType !== 'csat') continue
    const key = `${r.projectId}\0${r.urlPath}`
    const entry = pageMap.get(key) || { projectId: r.projectId, scores: [] }
    entry.scores.push(r.score)
    pageMap.set(key, entry)
  }

  const worstPages = [...pageMap.entries()]
    .filter(([, entry]) => entry.scores.length >= 3)
    .map(([key, entry]) => {
      const path = key.slice(key.indexOf('\0') + 1)
      return {
        path,
        projectId: entry.projectId,
        projectName: nameById.get(entry.projectId) || entry.projectId,
        count: entry.scores.length,
        csatPercent: csatPercent(entry.scores),
        average: averageScore(entry.scores),
      }
    })
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
      projectId: responses.projectId,
      projectName: projects.name,
    })
    .from(responses)
    .innerJoin(projects, eq(responses.projectId, projects.id))
    .where(and(
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
      projectId: r.projectId,
      projectName: r.projectName,
    }))

  const byProject = new Map<string, { total: number, csat: number[] }>()
  for (const p of allProjects) byProject.set(p.id, { total: 0, csat: [] })
  for (const r of current) {
    const entry = byProject.get(r.projectId) || { total: 0, csat: [] }
    entry.total += 1
    if (r.surveyType === 'csat' && r.score != null) entry.csat.push(r.score)
    byProject.set(r.projectId, entry)
  }

  const projectRows = allProjects
    .map((p) => {
      const entry = byProject.get(p.id)!
      return {
        id: p.id,
        name: p.name,
        total: entry.total,
        csatPercent: csatPercent(entry.csat),
      }
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

  const daily = dayKeys.map((day) => {
    const scores = byDay.get(day) || []
    return {
      day,
      count: scores.length,
      avg: averageScore(scores),
      csatPercent: csatPercent(scores),
    }
  })

  const dailyByProject = projectRows
    .filter(p => p.total > 0)
    .map(p => ({
      projectId: p.id,
      projectName: p.name,
      daily: dayKeys.map((day) => {
        const scores = byDayProject.get(day)?.get(p.id) || []
        return {
          day,
          count: scores.length,
          avg: averageScore(scores),
          csatPercent: csatPercent(scores),
        }
      }),
    }))

  return {
    from,
    to,
    previousFrom,
    previousTo,
    projectCount: allProjects.length,
    total: current.length,
    previousTotal: previous.length,
    withComment: current.filter(r => r.comment && r.comment.trim()).length,
    csatPercent: csatPercent(currentCsat),
    previousCsatPercent: csatPercent(previousCsat),
    average: averageScore(currentCsat),
    distribution: [...distMap.entries()].map(([score, count]) => ({ score, count })),
    helpfulDistribution: [...helpfulDistMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([score, count]) => ({ score, count })),
    thumbsPositivePercent: thumbs.length
      ? Math.round((thumbsPositive / thumbs.length) * 1000) / 10
      : null,
    daily,
    dailyByProject,
    projects: projectRows,
    worstPages,
    recentComments,
  }
}
