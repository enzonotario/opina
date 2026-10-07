import { eq } from 'drizzle-orm'
import type { CsvImportMapping } from '../../shared/csv-import'
import {
  normalizeDevice,
  parseCsv,
  parseImportDate,
  parseScore,
  splitUrl,
} from '../../shared/csv-import'
import { responses } from '../db/schema'
import { useDb } from '../db/client'
import { createId } from './ids'
import { getProjectOrThrow } from './projects'
import { getSurveyOrThrow } from './surveys'

const MAX_ROWS = 5000

export type ImportCsvResult = {
  imported: number
  skipped: number
  errors: Array<{ row: number, message: string }>
  detected: 'hotjar' | 'generic'
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

export function importCsvResponses(
  projectId: string,
  input: {
    csv: string
    surveyId: string
    mapping: CsvImportMapping
  },
): ImportCsvResult {
  getProjectOrThrow(projectId)
  const survey = getSurveyOrThrow(projectId, input.surveyId)
  const surveyType = survey.type as 'csat' | 'thumbs' | 'helpful'

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
    ? 'hotjar' as const
    : 'generic' as const

  const seen = existingImportKeys(projectId)
  const db = useDb()
  let imported = 0
  let skipped = 0
  const errors: Array<{ row: number, message: string }> = []

  for (let i = 0; i < records.length; i++) {
    const record = records[i]!
    const rowNum = i + 2 // 1-based + header

    try {
      const scoreRaw = record[input.mapping.score] ?? ''
      const score = parseScore(scoreRaw, surveyType)
      if (score == null) {
        errors.push({ row: rowNum, message: `Invalid score "${scoreRaw}"` })
        continue
      }

      const comment = input.mapping.comment
        ? (record[input.mapping.comment] || '').trim() || null
        : null

      const dateRaw = input.mapping.date ? (record[input.mapping.date] || '') : ''
      const createdAt = parseImportDate(dateRaw) ?? Date.now()

      const urlRaw = input.mapping.url ? (record[input.mapping.url] || '') : ''
      const { host, path } = splitUrl(urlRaw)

      const deviceRaw = input.mapping.device ? (record[input.mapping.device] || '') : ''
      const device = normalizeDevice(deviceRaw)

      const visitorRaw = input.mapping.visitor
        ? (record[input.mapping.visitor] || '')
        : ''
      const visitorId = (visitorRaw || `import-${rowNum}`).slice(0, 128)

      const hotjarNumber = record.Number || ''
      const responseUrl = record['Response URL'] || ''
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
        importKey,
        source: detected,
      }
      if (record.Country) metadata.country = record.Country
      if (record.Browser) metadata.browser = record.Browser
      if (record.OS) metadata.os = record.OS
      if (hotjarNumber) metadata.hotjarNumber = hotjarNumber
      if (responseUrl) metadata.hotjarResponseUrl = responseUrl

      db.insert(responses).values({
        id: createId('rsp'),
        projectId,
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
      errors.push({
        row: rowNum,
        message: e instanceof Error ? e.message : 'Row failed',
      })
    }
  }

  return { imported, skipped, errors: errors.slice(0, 50), detected }
}
