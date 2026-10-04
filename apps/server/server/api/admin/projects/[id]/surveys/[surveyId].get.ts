import { requireAdminSession } from '../../../../../utils/auth'
import { getSurveyOrThrow, toSurveyDto } from '../../../../../utils/surveys'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  const surveyId = getRouterParam(event, 'surveyId')
  if (!id || !surveyId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ids' })
  }
  return { survey: toSurveyDto(getSurveyOrThrow(id, surveyId)) }
})
