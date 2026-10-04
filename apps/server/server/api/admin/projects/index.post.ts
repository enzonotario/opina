import * as v from 'valibot'
import { ProjectCreateSchema } from '../../../../shared/projects'
import { createProject } from '../../../utils/projects'
import { requireAdminSession } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const body = await readValidatedBody(event, data =>
    v.parse(ProjectCreateSchema, data),
  )
  const project = createProject(body)
  return { project }
})
