import { getRequestHeader, setResponseHeader, type H3Event } from 'h3'
import { isOriginAllowed } from '../../shared/origin'

export { isOriginAllowed }

export function getRequestOrigin(event: H3Event) {
  return getRequestHeader(event, 'origin') || null
}

export function setCorsHeaders(event: H3Event, origin: string) {
  setResponseHeader(event, 'Access-Control-Allow-Origin', origin)
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')
  setResponseHeader(event, 'Access-Control-Max-Age', '86400')
  setResponseHeader(event, 'Vary', 'Origin')
}
