import { setCorsHeaders } from '../../../utils/cors'

export default defineEventHandler((event) => {
  const origin = getRequestHeader(event, 'origin')
  if (origin) setCorsHeaders(event, origin)
  setResponseStatus(event, 204)
  return null
})
