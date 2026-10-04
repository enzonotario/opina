import { requireAdminSession } from '../../../../../utils/auth'
import { listSurveys } from '../../../../../utils/surveys'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing project id' })
  return { surveys: listSurveys(id) }
})
