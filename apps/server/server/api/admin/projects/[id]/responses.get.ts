import { requireAdminSession } from '../../../../utils/auth'
import { listResponses, parseScoreList } from '../../../../utils/responses'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing project id' })

  const q = getQuery(event)
  return listResponses(id, {
    surveyId: q.surveyId ? String(q.surveyId) : undefined,
    from: q.from != null ? Number(q.from) : undefined,
    to: q.to != null ? Number(q.to) : undefined,
    scoreMin: q.scoreMin != null ? Number(q.scoreMin) : undefined,
    scoreMax: q.scoreMax != null ? Number(q.scoreMax) : undefined,
    scores: parseScoreList(q.scores),
    path: q.path ? String(q.path) : undefined,
    hasComment: q.hasComment === 'true' ? true : q.hasComment === 'false' ? false : undefined,
    q: q.q ? String(q.q) : undefined,
    limit: q.limit != null ? Number(q.limit) : undefined,
    offset: q.offset != null ? Number(q.offset) : undefined,
  })
})
