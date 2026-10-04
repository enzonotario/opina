import { getProjectByPublicKey, projectOrigins } from '../../../utils/widget'
import {
  getRequestOrigin,
  isOriginAllowed,
  setCorsHeaders,
} from '../../../utils/cors'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const key = String(query.key || '')
  const origin = getRequestOrigin(event)
  const project = key ? getProjectByPublicKey(key) : null

  if (project && isOriginAllowed(origin, projectOrigins(project))) {
    setCorsHeaders(event, origin!)
  }

  setResponseStatus(event, 204)
  return null
})
