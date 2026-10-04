import { getRequestIP, type H3Event } from 'h3'

export function clientIp(event: H3Event) {
  const trust = process.env.OPINA_TRUST_PROXY !== 'false'
  return getRequestIP(event, { xForwardedFor: trust }) || 'unknown'
}
