import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod/v4'
import { listProjects } from './projects'
import {
  getResponse,
  listResponses,
  updateResponse,
} from './responses'

function jsonText(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  }
}

function toolError(message: string) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: message }],
  }
}

/** Fresh MCP server per request (stateless HTTP). */
export function createOpinaMcpServer() {
  const server = new McpServer({
    name: 'opina',
    version: '0.1.0',
  })

  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description: 'List all Opina projects (id, name, homepage).',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async () => {
      const projects = listProjects().map(p => ({
        id: p.id,
        name: p.name,
        homepage: p.homepage,
        logoUrl: p.logoUrl,
      }))
      return jsonText({ projects })
    },
  )

  server.registerTool(
    'list_responses',
    {
      title: 'List responses',
      description:
        'List survey responses for a project. Default resolved=false (open only). Use for triage.',
      inputSchema: {
        projectId: z.string().describe('Project id (prj_…)'),
        resolved: z
          .boolean()
          .optional()
          .describe('Filter by resolved state. Default false (open). Omit with null via all=true.'),
        all: z
          .boolean()
          .optional()
          .describe('If true, ignore resolved filter and return all matching responses.'),
        hasComment: z.boolean().optional().describe('Only responses with/without a comment.'),
        q: z.string().optional().describe('Keyword search in comment text.'),
        path: z.string().optional().describe('Substring match on url path.'),
        limit: z.number().int().min(1).max(100).optional().describe('Page size (default 50).'),
        offset: z.number().int().min(0).optional().describe('Offset for pagination.'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      try {
        const resolvedFilter = args.all
          ? undefined
          : args.resolved === undefined
            ? false
            : args.resolved
        const data = listResponses(args.projectId, {
          resolved: resolvedFilter,
          hasComment: args.hasComment,
          q: args.q,
          path: args.path,
          limit: args.limit ?? 50,
          offset: args.offset ?? 0,
        })
        return jsonText(data)
      } catch (e) {
        const err = e as { statusMessage?: string, message?: string }
        return toolError(err.statusMessage || err.message || 'list_responses failed')
      }
    },
  )

  server.registerTool(
    'get_response',
    {
      title: 'Get response',
      description: 'Fetch one response by id, including adminNote and resolution fields.',
      inputSchema: {
        projectId: z.string().describe('Project id (prj_…)'),
        responseId: z.string().describe('Response id (rsp_…)'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ projectId, responseId }) => {
      try {
        return jsonText(getResponse(projectId, responseId))
      } catch (e) {
        const err = e as { statusMessage?: string, message?: string }
        return toolError(err.statusMessage || err.message || 'get_response failed')
      }
    },
  )

  server.registerTool(
    'update_response',
    {
      title: 'Update response',
      description:
        'Update resolved state and/or adminNote. When setting resolved=true via MCP, adminNote is required (short decision). Does not change autoResolved.',
      inputSchema: {
        projectId: z.string().describe('Project id (prj_…)'),
        responseId: z.string().describe('Response id (rsp_…)'),
        resolved: z.boolean().optional().describe('Set resolved (true) or reopen (false).'),
        adminNote: z
          .string()
          .nullable()
          .optional()
          .describe('Internal note. Required when resolving. Empty string clears the note.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ projectId, responseId, resolved, adminNote }) => {
      try {
        if (resolved === undefined && adminNote === undefined) {
          return toolError('Provide resolved and/or adminNote')
        }
        if (resolved === true) {
          const note = typeof adminNote === 'string' ? adminNote.trim() : ''
          if (!note) {
            return toolError('adminNote is required when resolving a response via MCP')
          }
        }
        const patch: { resolved?: boolean, adminNote?: string | null } = {}
        if (resolved !== undefined) patch.resolved = resolved
        if (adminNote !== undefined) {
          patch.adminNote = adminNote === null || adminNote.trim() === ''
            ? null
            : adminNote.trim()
        }
        return jsonText(updateResponse(projectId, responseId, patch))
      } catch (e) {
        const err = e as { statusMessage?: string, message?: string }
        return toolError(err.statusMessage || err.message || 'update_response failed')
      }
    },
  )

  return server
}
