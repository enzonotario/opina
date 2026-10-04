import { projects } from '../../../db/schema'
import { useDb } from '../../../db/client'
import { projectOrigins } from '../../../utils/widget'
import {
  getRequestOrigin,
  isOriginAllowed,
  setCorsHeaders,
} from '../../../utils/cors'

export default defineEventHandler((event) => {
  const origin = getRequestOrigin(event)
  if (origin) {
    const allowed = useDb()
      .select()
      .from(projects)
      .all()
      .some(row => isOriginAllowed(origin, projectOrigins(row)))
    if (allowed) setCorsHeaders(event, origin)
  }
  setResponseStatus(event, 204)
  return null
})
