import * as v from 'valibot'
import { SurveyUpdateSchema } from '../../../../../../shared/surveys'
import { requireAdminSession } from '../../../../../utils/auth'
import { updateSurvey } from '../../../../../utils/surveys'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  const surveyId = getRouterParam(event, 'surveyId')
  if (!id || !surveyId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ids' })
  }

  const body = await readBody(event)
  const parsed = v.safeParse(SurveyUpdateSchema, body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.issues[0]?.message || 'Invalid survey',
    })
  }

  return { survey: updateSurvey(id, surveyId, parsed.output) }
})
