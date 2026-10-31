import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { requireAccessTokenFromHeader } from '../utils/access-tokens'
import { createOpinaMcpServer } from '../utils/mcp-server'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, mcp-session-id, Last-Event-ID, mcp-protocol-version',
  'Access-Control-Expose-Headers': 'mcp-session-id, mcp-protocol-version',
}

function withCors(response: Response) {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export default defineEventHandler(async (event) => {
  if (event.method === 'OPTIONS') {
    setResponseHeaders(event, CORS_HEADERS)
    setResponseStatus(event, 204)
    return ''
  }

  try {
    requireAccessTokenFromHeader(getHeader(event, 'authorization') || undefined)
  } catch (e) {
    const err = e as { statusCode?: number, statusMessage?: string }
    return withCors(
      Response.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: err.statusMessage || 'Unauthorized',
          },
          id: null,
        },
        {
          status: err.statusCode || 401,
          headers: {
            'WWW-Authenticate': 'Bearer realm="opina-mcp"',
          },
        },
      ),
    )
  }

  const server = createOpinaMcpServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)

  try {
    const request = toWebRequest(event)
    const response = await transport.handleRequest(request)
    return withCors(response)
  } finally {
    await transport.close().catch(() => {})
    await server.close().catch(() => {})
  }
})
