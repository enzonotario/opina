import { requireAdminSession } from '../../../../utils/auth'
import { importCsvResponses } from '../../../../utils/import-responses'
import type { CsvImportMapping } from '../../../../../shared/csv-import'

type Body = {
  csv?: string
  surveyId?: string
  mapping?: Partial<CsvImportMapping>
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing project id' })

  const body = await readBody<Body>(event)
  const csv = typeof body.csv === 'string' ? body.csv : ''
  const surveyId = typeof body.surveyId === 'string' ? body.surveyId : ''

  if (!csv.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Missing csv' })
  }
  if (Buffer.byteLength(csv, 'utf8') > 5 * 1024 * 1024) {
    throw createError({ statusCode: 400, statusMessage: 'CSV larger than 5MB' })
  }
  if (!surveyId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing surveyId' })
  }

  const mapping: CsvImportMapping = {
    score: String(body.mapping?.score || ''),
    comment: String(body.mapping?.comment || ''),
    date: String(body.mapping?.date || ''),
    url: String(body.mapping?.url || ''),
    device: String(body.mapping?.device || ''),
    visitor: String(body.mapping?.visitor || ''),
  }

  return importCsvResponses(id, { csv, surveyId, mapping })
})
