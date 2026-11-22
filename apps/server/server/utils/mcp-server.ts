import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as v from 'valibot'
import * as z from 'zod/v4'
import { ProjectCreateSchema } from '../../shared/projects'
import { SurveyUpdateSchema } from '../../shared/surveys'
import { createProject, deleteProject, listProjects } from './projects'
import {
  getResponse,
  listResponses,
  updateResponse,
} from './responses'
import { listSurveys, updateSurvey } from './surveys'

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
      description: 'List all Opina projects (id, name, homepage, publicKey, allowedOrigins).',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async () => {
      const projects = listProjects().map(p => ({
        id: p.id,
        name: p.name,
        homepage: p.homepage,
        logoUrl: p.logoUrl,
        publicKey: p.publicKey,
        allowedOrigins: p.allowedOrigins,
      }))
      return jsonText({ projects })
    },
  )

  server.registerTool(
    'create_project',
    {
      title: 'Create project',
      description:
        'Create an Opina project with a default CSAT survey (trigger: manual, frequency: cooldown 30d). Returns id + publicKey for the embed snippet.',
      inputSchema: {
        name: z.string().min(1).max(120).describe('Project display name'),
        allowedOrigins: z
          .array(z.string())
          .max(50)
          .optional()
          .describe('Allowed embed origins (https://…), one per host'),
        homepage: z.string().optional().describe('Homepage URL'),
        logoUrl: z.string().optional().describe('Logo URL for the admin UI'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      try {
        const body = v.parse(ProjectCreateSchema, {
          name: args.name,
          allowedOrigins: args.allowedOrigins || [],
          homepage: args.homepage || null,
          logoUrl: args.logoUrl || null,
        })
        const project = createProject(body)
        const surveys = listSurveys(project.id).map(s => ({
          id: s.id,
          name: s.name,
          type: s.type,
          trigger: s.trigger,
          frequency: s.frequency,
          isActive: s.isActive,
        }))
        return jsonText({ project, surveys })
      } catch (e) {
        const err = e as { statusMessage?: string, message?: string }
        return toolError(err.statusMessage || err.message || 'create_project failed')
      }
    },
  )

  server.registerTool(
    'delete_project',
    {
      title: 'Delete project',
      description:
        'Permanently delete a project and cascaded surveys/responses/webhooks.',
      inputSchema: {
        projectId: z.string().describe('Project id (prj_…)'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ projectId }) => {
      try {
        return jsonText(deleteProject(projectId))
      } catch (e) {
        const err = e as { statusMessage?: string, message?: string }
        return toolError(err.statusMessage || err.message || 'delete_project failed')
      }
    },
  )

  server.registerTool(
    'list_surveys',
    {
      title: 'List surveys',
      description: 'List surveys for a project (id, trigger, frequency, active).',
      inputSchema: {
        projectId: z.string().describe('Project id (prj_…)'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ projectId }) => {
      try {
        const surveys = listSurveys(projectId).map(s => ({
          id: s.id,
          name: s.name,
          type: s.type,
          trigger: s.trigger,
          frequency: s.frequency,
          isActive: s.isActive,
          question: s.question,
        }))
        return jsonText({ surveys })
      } catch (e) {
        const err = e as { statusMessage?: string, message?: string }
        return toolError(err.statusMessage || err.message || 'list_surveys failed')
      }
    },
  )

  server.registerTool(
    'update_survey',
    {
      title: 'Update survey',
      description:
        'Patch a survey (trigger, frequency, question, appearance, targeting, isActive, …).',
      inputSchema: {
        projectId: z.string().describe('Project id (prj_…)'),
        surveyId: z.string().describe('Survey id (srv_…)'),
        patch: z
          .record(z.string(), z.unknown())
          .describe('Fields to update (SurveyUpdate shape)'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ projectId, surveyId, patch }) => {
      try {
        const parsed = v.safeParse(SurveyUpdateSchema, patch)
        if (!parsed.success) {
          return toolError(`Invalid patch: ${parsed.issues.map(i => i.message).join('; ')}`)
        }
        const survey = updateSurvey(projectId, surveyId, parsed.output)
        return jsonText({ survey })
      } catch (e) {
        const err = e as { statusMessage?: string, message?: string }
        return toolError(err.statusMessage || err.message || 'update_survey failed')
      }
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
