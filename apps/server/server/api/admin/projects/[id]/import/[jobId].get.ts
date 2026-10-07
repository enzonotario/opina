import { requireAdminSession } from '../../../../../utils/auth'
import { getImportJob } from '../../../../../utils/import-responses'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = getRouterParam(event, 'id')
  const jobId = getRouterParam(event, 'jobId')
  if (!id || !jobId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ids' })
  }
  return { job: getImportJob(id, jobId) }
})
