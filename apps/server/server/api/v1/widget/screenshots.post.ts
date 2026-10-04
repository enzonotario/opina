import * as v from 'valibot'
import { and, eq } from 'drizzle-orm'
import { responses } from '../../../db/schema'
import { useDb } from '../../../db/client'
import {
  getActiveSurvey,
  getProjectByPublicKey,
  projectOrigins,
} from '../../../utils/widget'
import {
  getRequestOrigin,
  isOriginAllowed,
  setCorsHeaders,
} from '../../../utils/cors'
import { consumeRateLimit } from '../../../utils/rate-limit'
import { clientIp } from '../../../utils/request-ip'
import { parseJsonBody } from '../../../utils/json-body'
import { saveScreenshotJpeg } from '../../../utils/screenshots'
import { toSurveyDto } from '../../../utils/surveys'

const BodySchema = v.object({
  key: v.pipe(v.string(), v.startsWith('pk_')),
  surveyId: v.pipe(v.string(), v.startsWith('srv_')),
  responseId: v.pipe(v.string(), v.startsWith('rsp_')),
  visitorId: v.pipe(v.string(), v.minLength(3), v.maxLength(64)),
  image: v.pipe(v.string(), v.minLength(32), v.maxLength(700_000)),
})

export default defineEventHandler(async (event) => {
  const raw = await readRawBody(event, 'utf8')
  if (raw && Buffer.byteLength(raw, 'utf8') > 700 * 1024) {
    throw createError({ statusCode: 413, statusMessage: 'Body too large' })
  }

  const body = v.parse(BodySchema, parseJsonBody(raw))
  const origin = getRequestOrigin(event)

  const project = getProjectByPublicKey(body.key)
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown project key' })
  }

  const allowed = projectOrigins(project)
  if (!isOriginAllowed(origin, allowed)) {
    throw createError({ statusCode: 403, statusMessage: 'Origin not allowed' })
  }
  setCorsHeaders(event, origin!)

  const ip = clientIp(event)
  if (!consumeRateLimit(`${ip}:${project.id}:screenshots`)) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })
  }

  const surveyRow = getActiveSurvey(project.id, body.surveyId)
  if (!surveyRow) {
    throw createError({ statusCode: 404, statusMessage: 'Survey not found' })
  }
  const survey = toSurveyDto(surveyRow)
  if (!survey.appearance.includeScreenshot) {
    throw createError({ statusCode: 400, statusMessage: 'Screenshots disabled for this survey' })
  }

  const row = useDb()
    .select()
    .from(responses)
    .where(and(
      eq(responses.id, body.responseId),
      eq(responses.projectId, project.id),
      eq(responses.surveyId, body.surveyId),
      eq(responses.visitorId, body.visitorId),
    ))
    .get()

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Response not found' })
  }
  if (row.screenshotPath) {
    return { ok: true, path: row.screenshotPath }
  }

  const SCREENSHOT_TTL_MS = 5 * 60 * 1000
  if (Date.now() - row.createdAt > SCREENSHOT_TTL_MS) {
    throw createError({ statusCode: 400, statusMessage: 'Screenshot window expired' })
  }

  const path = saveScreenshotJpeg(row.id, body.image)
  return { ok: true, path }
})
