import * as v from 'valibot'
import { responses } from '../../../db/schema'
import { useDb } from '../../../db/client'
import { createId } from '../../../utils/ids'
import {
  getActiveSurvey,
  getProjectByPublicKey,
  projectOrigins,
  scoreRange,
} from '../../../utils/widget'
import {
  getRequestOrigin,
  isOriginAllowed,
  setCorsHeaders,
} from '../../../utils/cors'
import { consumeRateLimit } from '../../../utils/rate-limit'
import { clientIp } from '../../../utils/request-ip'
import { parseJsonBody } from '../../../utils/json-body'
import { isVisitorDailyCapReached } from '../../../utils/visitor-limit'

const MIN_SHOWN_MS = 1000
const FAKE_OK = { ok: true as const }

const BodySchema = v.object({
  key: v.pipe(v.string(), v.startsWith('pk_')),
  surveyId: v.pipe(v.string(), v.startsWith('srv_')),
  score: v.optional(v.nullable(v.number())),
  comment: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(2000)))),
  path: v.pipe(v.string(), v.maxLength(2048)),
  locale: v.optional(v.pipe(v.string(), v.maxLength(32))),
  visitorId: v.pipe(v.string(), v.minLength(3), v.maxLength(64)),
  metadata: v.optional(v.record(v.string(), v.unknown())),
  hp: v.optional(v.string()),
  host: v.optional(v.pipe(v.string(), v.maxLength(255))),
  device: v.optional(v.picklist(['mobile', 'tablet', 'desktop'])),
  shownAt: v.optional(v.number()),
})

function isTooFast(shownAt: number | undefined) {
  return typeof shownAt === 'number'
    && Number.isFinite(shownAt)
    && Date.now() - shownAt < MIN_SHOWN_MS
}

function hostFromOrigin(origin: string | null, fallback: string) {
  if (!origin) return fallback
  try {
    return new URL(origin).host
  } catch {
    return fallback
  }
}

export default defineEventHandler(async (event) => {
  const raw = await readRawBody(event, 'utf8')
  if (raw && Buffer.byteLength(raw, 'utf8') > 8 * 1024) {
    throw createError({ statusCode: 413, statusMessage: 'Body too large' })
  }

  const body = v.parse(BodySchema, parseJsonBody(raw))
  const origin = getRequestOrigin(event)

  if (body.hp || isTooFast(body.shownAt)) return FAKE_OK

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
  if (!consumeRateLimit(`${ip}:${project.id}:responses`)) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })
  }

  const survey = getActiveSurvey(project.id, body.surveyId)
  if (!survey) {
    throw createError({ statusCode: 404, statusMessage: 'Survey not found' })
  }

  if (isVisitorDailyCapReached(survey.id, body.visitorId)) return FAKE_OK

  const range = scoreRange(survey.type)
  if (range) {
    if (body.score == null || body.score < range[0] || body.score > range[1]) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid score' })
    }
  }

  const metadata = JSON.stringify(body.metadata || {})
  if (Buffer.byteLength(metadata, 'utf8') > 2048) {
    throw createError({ statusCode: 400, statusMessage: 'metadata too large' })
  }

  const id = createId('rsp')
  useDb().insert(responses).values({
    id,
    projectId: project.id,
    surveyId: survey.id,
    score: body.score ?? null,
    comment: body.comment || null,
    urlPath: (body.path.split('?')[0] || '/').slice(0, 2048),
    urlHost: hostFromOrigin(origin, body.host || '').slice(0, 255),
    locale: body.locale || null,
    device: body.device || null,
    visitorId: body.visitorId,
    metadata,
    createdAt: Date.now(),
  }).run()

  return { ok: true, id }
})
