import { requireAdminSession } from '../../../../utils/auth'
import { exportResponses, parseScoreList } from '../../../../utils/responses'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing project id' })

  const q = getQuery(event)
  const format = q.format === 'json' ? 'json' : 'csv'
  const file = exportResponses(id, format, {
    surveyId: q.surveyId ? String(q.surveyId) : undefined,
    from: q.from != null ? Number(q.from) : undefined,
    to: q.to != null ? Number(q.to) : undefined,
    scores: parseScoreList(q.scores),
    path: q.path ? String(q.path) : undefined,
    hasComment: q.hasComment === 'true' ? true : q.hasComment === 'false' ? false : undefined,
    q: q.q ? String(q.q) : undefined,
  })

  setHeader(event, 'Content-Type', file.contentType)
  setHeader(event, 'Content-Disposition', `attachment; filename="${file.filename}"`)
  return file.body
})
