import { and, eq } from 'drizzle-orm'
import { responses } from '../../../../../../db/schema'
import { useDb } from '../../../../../../db/client'
import { requireAdminSession } from '../../../../../../utils/auth'
import { getProjectOrThrow } from '../../../../../../utils/projects'
import { readScreenshot } from '../../../../../../utils/screenshots'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const projectId = getRouterParam(event, 'id')
  const responseId = getRouterParam(event, 'responseId')
  if (!projectId || !responseId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ids' })
  }
  getProjectOrThrow(projectId)

  const row = useDb()
    .select()
    .from(responses)
    .where(and(
      eq(responses.id, responseId),
      eq(responses.projectId, projectId),
    ))
    .get()

  if (!row?.screenshotPath) {
    throw createError({ statusCode: 404, statusMessage: 'No screenshot' })
  }

  const buf = readScreenshot(row.screenshotPath)
  if (!buf) {
    throw createError({ statusCode: 404, statusMessage: 'Screenshot file missing' })
  }

  setHeader(event, 'Content-Type', 'image/jpeg')
  setHeader(event, 'Cache-Control', 'private, max-age=3600')
  return buf
})
