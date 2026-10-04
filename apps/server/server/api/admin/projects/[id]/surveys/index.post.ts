import * as v from 'valibot'
import { SurveyCreateSchema } from '../../../../../../shared/surveys'
import { requireAdminSession } from '../../../../../utils/auth'
import { createSurvey } from '../../../../../utils/surveys'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing project id' })

  const body = await readBody(event)
  const parsed = v.safeParse(SurveyCreateSchema, body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.issues[0]?.message || 'Invalid survey',
    })
  }

  return { survey: createSurvey(id, parsed.output) }
})
