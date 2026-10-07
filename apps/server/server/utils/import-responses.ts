import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { and, eq } from 'drizzle-orm'
import type { CsvImportMapping } from '../../shared/csv-import'
import {
  normalizeDevice,
  parseCsv,
  parseImportDate,
  parseScore,
  splitUrl,
} from '../../shared/csv-import'
import { importJobs, responses } from '../db/schema'
import { getSqlite, useDb } from '../db/client'
import { createId } from './ids'
import { getProjectOrThrow } from './projects'
import { getSurveyOrThrow } from './surveys'

const MAX_ROWS = 5000
const BATCH = 75
const running = new Set<string>()

export type ImportJobDto = {
  id: string
  projectId: string
  surveyId: string
  status: 'queued' | 'running' | 'done' | 'error'
  total: number
  processed: number
  imported: number
  skipped: number
  errors: Array<{ row: number, message: string }>
  errorMessage: string | null
  detected: 'hotjar' | 'generic' | null
  createdAt: number
  updatedAt: number
}

function resolveDataDir() {
  try {
    const config = useRuntimeConfig()
    return String(config.opinaDataDir || process.env.OPINA_DATA_DIR || './data')
  }
  catch {
    return process.env.OPINA_DATA_DIR || './data'
  }
}

function importsDir() {
  const dir = join(resolveDataDir(), 'imports')
  mkdirSync(dir, { recursive: true })
  return dir
}

function csvPath(jobId: string) {
  return join(importsDir(), `${jobId}.csv`)
}

function mappingPath(jobId: string) {
  return join(importsDir(), `${jobId}.mapping.json`)
}

function yieldEventLoop() {
  return new Promise<void>(resolve => setImmediate(resolve))
}

function toJobDto(row: typeof importJobs.$inferSelect): ImportJobDto {
  let errors: Array<{ row: number, message: string }> = []
  try {
    const parsed = JSON.parse(row.errors || '[]')
    if (Array.isArray(parsed)) errors = parsed
  }
  catch {
    /* ignore */
  }
  return {
    id: row.id,
    projectId: row.projectId,
    surveyId: row.surveyId,
    status: row.status as ImportJobDto['status'],
    total: row.total,
    processed: row.processed,
    imported: row.imported,
    skipped: row.skipped,
    errors,
    errorMessage: row.errorMessage,
    detected: (row.detected as ImportJobDto['detected']) || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function patchJob(jobId: string, patch: Partial<{
  status: string
  total: number
  processed: number
  imported: number
  skipped: number
  errors: Array<{ row: number, message: string }>
  errorMessage: string | null
  detected: string | null
}>) {
  const now = Date.now()
  useDb().update(importJobs).set({
    ...(patch.status != null ? { status: patch.status } : {}),
    ...(patch.total != null ? { total: patch.total } : {}),
    ...(patch.processed != null ? { processed: patch.processed } : {}),
    ...(patch.imported != null ? { imported: patch.imported } : {}),
    ...(patch.skipped != null ? { skipped: patch.skipped } : {}),
    ...(patch.errors != null ? { errors: JSON.stringify(patch.errors.slice(0, 50)) } : {}),
    ...(patch.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
    ...(patch.detected !== undefined ? { detected: patch.detected } : {}),
    updatedAt: now,
  }).where(eq(importJobs.id, jobId)).run()
}

function existingImportKeys(projectId: string) {
  const rows = useDb()
    .select({ metadata: responses.metadata })
    .from(responses)
    .where(eq(responses.projectId, projectId))
    .all()

  const keys = new Set<string>()
  for (const row of rows) {
    try {
      const meta = JSON.parse(row.metadata || '{}') as Record<string, unknown>
      if (typeof meta.importKey === 'string' && meta.importKey) keys.add(meta.importKey)
    }
    catch {
      /* ignore */
    }
  }
  return keys
}

function cleanupFiles(jobId: string) {
  for (const path of [csvPath(jobId), mappingPath(jobId)]) {
    try {
      unlinkSync(path)
    }
    catch {
      /* ignore */
    }
  }
}

export function getImportJob(projectId: string, jobId: string): ImportJobDto {
  getProjectOrThrow(projectId)
  const row = useDb()
    .select()
    .from(importJobs)
    .where(and(eq(importJobs.id, jobId), eq(importJobs.projectId, projectId)))
    .get()
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Import job not found' })
  }
  return toJobDto(row)
}

export function enqueueImportJob(
  projectId: string,
  input: {
    csv: string
    surveyId: string
    mapping: CsvImportMapping
  },
): ImportJobDto {
  getProjectOrThrow(projectId)
  getSurveyOrThrow(projectId, input.surveyId)

  if (!input.mapping.score) {
    throw createError({ statusCode: 400, statusMessage: 'Score column is required' })
  }

  const { headers, records } = parseCsv(input.csv)
  if (!headers.length) {
    throw createError({ statusCode: 400, statusMessage: 'CSV has no header row' })
  }
  if (records.length > MAX_ROWS) {
    throw createError({
      statusCode: 400,
      statusMessage: `CSV too large (max ${MAX_ROWS} rows)`,
    })
  }

  const detected = headers.includes('Date Submitted') && headers.includes('Source URL')
    ? 'hotjar'
    : 'generic'

  const id = createId('job')
  const now = Date.now()
  writeFileSync(csvPath(id), input.csv, 'utf8')
  writeFileSync(mappingPath(id), JSON.stringify(input.mapping), 'utf8')

  useDb().insert(importJobs).values({
    id,
    projectId,
    surveyId: input.surveyId,
    status: 'queued',
    total: records.length,
    processed: 0,
    imported: 0,
    skipped: 0,
    errors: '[]',
    errorMessage: null,
    detected,
    createdAt: now,
    updatedAt: now,
  }).run()

  // Delay past the HTTP response flush. setImmediate can still race and block
  // the event loop with SQLite work before the client receives 200.
  setTimeout(() => {
    void processImportJob(id)
  }, 25)

  return getImportJob(projectId, id)
}

export async function processImportJob(jobId: string) {
  if (running.has(jobId)) return
  running.add(jobId)

  try {
    // Let the HTTP response flush before touching SQLite heavily.
    await yieldEventLoop()

    const job = useDb().select().from(importJobs).where(eq(importJobs.id, jobId)).get()
    if (!job) return
    if (job.status === 'done' || job.status === 'error') return

    patchJob(jobId, { status: 'running', errorMessage: null })
    await yieldEventLoop()

    const survey = getSurveyOrThrow(job.projectId, job.surveyId)
    const surveyType = survey.type as 'csat' | 'thumbs' | 'helpful'
    const mapping = JSON.parse(readFileSync(mappingPath(jobId), 'utf8')) as CsvImportMapping
    const csv = readFileSync(csvPath(jobId), 'utf8')
    const { records } = parseCsv(csv)
    const detected = (job.detected as 'hotjar' | 'generic') || 'generic'
    await yieldEventLoop()
    const seen = existingImportKeys(job.projectId)
    const db = useDb()
    const sqlite = getSqlite()

    let imported = 0
    let skipped = 0
    let processed = 0
    const errors: Array<{ row: number, message: string }> = []

    for (let start = 0; start < records.length; start += BATCH) {
      const chunk = records.slice(start, start + BATCH)

      const insertMany = sqlite.transaction(() => {
        for (let j = 0; j < chunk.length; j++) {
          const record = chunk[j]!
          const rowNum = start + j + 2
          processed++

          try {
            const scoreRaw = record[mapping.score] ?? ''
            const score = parseScore(scoreRaw, surveyType)
            if (score == null) {
              if (errors.length < 50) {
                errors.push({ row: rowNum, message: `Invalid score "${scoreRaw}"` })
              }
              continue
            }

            const comment = mapping.comment
              ? (record[mapping.comment] || '').trim() || null
              : null
            const dateRaw = mapping.date ? (record[mapping.date] || '') : ''
            const createdAt = parseImportDate(dateRaw) ?? Date.now()
            const urlRaw = mapping.url ? (record[mapping.url] || '') : ''
            const { host, path } = splitUrl(urlRaw)
            const deviceRaw = mapping.device ? (record[mapping.device] || '') : ''
            const device = normalizeDevice(deviceRaw)
            const visitorRaw = mapping.visitor ? (record[mapping.visitor] || '') : ''
            const visitorId = (visitorRaw || `import-${rowNum}`).slice(0, 128)

            const hotjarNumber = (record.Number || '').trim()
            const responseUrl = (record['Response URL'] || '').trim()
            const prid = responseUrl.match(/[?&]prid=([^&]+)/)?.[1] || ''
            const externalId = hotjarNumber || prid || ''
            const importKey = responseUrl
              ? `hotjar:${responseUrl}`
              : hotjarNumber
                ? `hotjar:${hotjarNumber}`
                : `csv:${createdAt}:${visitorId}:${score}:${path}`

            if (seen.has(importKey)) {
              skipped++
              continue
            }

            const metadata: Record<string, unknown> = {
              imported: true,
              source: detected,
              importKey,
            }
            if (externalId) metadata.externalId = externalId
            if (responseUrl) metadata.externalUrl = responseUrl
            if (record.Country) metadata.country = record.Country
            if (record.Browser) metadata.browser = record.Browser
            if (record.OS) metadata.os = record.OS
            // Keep Hotjar-specific keys for older UI / debugging.
            if (hotjarNumber) metadata.hotjarNumber = hotjarNumber
            if (responseUrl) metadata.hotjarResponseUrl = responseUrl

            db.insert(responses).values({
              id: createId('rsp'),
              projectId: job.projectId,
              surveyId: survey.id,
              score,
              comment,
              urlPath: path || '/',
              urlHost: host || '',
              locale: null,
              device,
              visitorId,
              metadata: JSON.stringify(metadata),
              screenshotPath: null,
              createdAt,
            }).run()

            seen.add(importKey)
            imported++
          }
          catch (e) {
            if (errors.length < 50) {
              errors.push({
                row: rowNum,
                message: e instanceof Error ? e.message : 'Row failed',
              })
            }
          }
        }
      })

      insertMany()
      patchJob(jobId, { processed, imported, skipped, errors })
      await yieldEventLoop()
    }

    patchJob(jobId, {
      status: 'done',
      processed,
      imported,
      skipped,
      errors,
      detected,
    })
    cleanupFiles(jobId)
  }
  catch (e) {
    patchJob(jobId, {
      status: 'error',
      errorMessage: e instanceof Error ? e.message : 'Import failed',
    })
    cleanupFiles(jobId)
  }
  finally {
    running.delete(jobId)
  }
}
