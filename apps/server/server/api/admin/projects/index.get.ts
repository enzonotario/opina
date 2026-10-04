import { listProjects } from '../../../utils/projects'
import { requireAdminSession } from '../../../utils/auth'
import { getProjectsSummary } from '../../../utils/stats'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const projects = listProjects()
  const summary = getProjectsSummary(30)
  return {
    projects: projects.map(p => ({
      ...p,
      stats30d: summary[p.id] || { total: 0, csatPercent: null },
    })),
  }
})
