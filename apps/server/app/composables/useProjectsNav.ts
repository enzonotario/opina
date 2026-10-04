import type { ProjectDto } from '../../shared/projects'

type ProjectRow = ProjectDto & {
  stats30d?: { total: number, csatPercent: number | null }
}

export function useProjectsNav() {
  const route = useRoute()

  const projectId = computed(() => {
    const id = route.params.id
    if (typeof id === 'string' && route.path.startsWith('/projects/')) return id
    return null
  })

  const inProject = computed(() => Boolean(projectId.value))

  const { data, refresh, status } = useFetch<{ projects: ProjectRow[] }>(
    '/api/admin/projects',
    { lazy: true, server: false },
  )

  const { data: projectDetail } = useFetch<{ project: ProjectDto }>(
    () => projectId.value ? `/api/admin/projects/${projectId.value}` : null,
    { watch: [projectId] },
  )

  const projects = computed(() => data.value?.projects || [])

  const currentProject = computed((): ProjectRow | null => {
    const fromList = projects.value.find(p => p.id === projectId.value)
    if (fromList) return fromList
    const detail = projectDetail.value?.project
    if (!detail) return null
    return { ...detail, stats30d: { total: 0, csatPercent: null } }
  })

  onMounted(() => {
    refresh()
  })

  return {
    projectId,
    inProject,
    projects,
    currentProject,
    refresh,
    status,
  }
}
