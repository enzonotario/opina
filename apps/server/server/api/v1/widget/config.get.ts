import {
  getProjectByPublicKey,
  listActiveSurveys,
  projectOrigins,
} from '../../../utils/widget'
import {
  getRequestOrigin,
  isOriginAllowed,
  setCorsHeaders,
} from '../../../utils/cors'
import { consumeRateLimit } from '../../../utils/rate-limit'
import { clientIp } from '../../../utils/request-ip'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const key = String(query.key || '')
  const origin = getRequestOrigin(event)

  if (!key.startsWith('pk_')) {
    throw createError({ statusCode: 400, statusMessage: 'Missing key' })
  }

  const project = getProjectByPublicKey(key)
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown project key' })
  }

  const allowed = projectOrigins(project)
  if (!isOriginAllowed(origin, allowed)) {
    throw createError({ statusCode: 403, statusMessage: 'Origin not allowed' })
  }

  setCorsHeaders(event, origin!)

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return null
  }

  const ip = clientIp(event)
  if (!consumeRateLimit(`${ip}:${project.id}:config`)) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })
  }

  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')

  return {
    projectId: project.id,
    settings: JSON.parse(project.settings || '{}'),
    surveys: listActiveSurveys(project.id),
  }
})
