<script setup lang="ts">
type AccountStats = {
  csatPercent: number | null
  previousCsatPercent: number | null
  average: number | null
  total: number
  previousTotal: number
  withComment: number
  projectCount: number
  distribution: Array<{ score: number, count: number }>
  daily: Array<{ day: string, count: number, csatPercent: number | null }>
  dailyByProject: Array<{
    projectId: string
    projectName: string
    daily: Array<{ day: string, count: number, csatPercent: number | null }>
  }>
  projects: Array<{
    id: string
    name: string
    total: number
    csatPercent: number | null
  }>
  worstPages: Array<{
    path: string
    count: number
    csatPercent: number | null
    projectId: string
    projectName: string
  }>
  recentComments: Array<{
    id: string
    score: number | null
    comment: string
    urlPath: string
    createdAt: number
    projectId: string
    projectName: string
  }>
}

const EMOJIS = ['😠', '🙁', '😐', '🙂', '😍']
// High-contrast palette so adjacent project bars read clearly.
const CHART_COLORS = ['#16a34a', '#2563eb', '#c026d3', '#ea580c', '#0891b2', '#ca8a04', '#dc2626', '#4f46e5']

const { data: statsData, status: statsStatus, refresh: refreshStats } = await useFetch<{ stats: AccountStats }>(
  '/api/admin/stats?days=30',
)

const { autoRefresh } = useAutoRefresh(() => refreshStats())

const chartGroup = useLocalStorage<'all' | 'projects'>('opina:chart-group', 'all')

const chartGroupItems = [
  { label: 'All', value: 'all' },
  { label: 'By project', value: 'projects' },
]

// Mount tabs after client localStorage is ready (avoids SSR default vs stored value mismatch).
const chartGroupReady = ref(false)
onMounted(() => {
  chartGroupReady.value = true
})

const stats = computed(() => statsData.value?.stats)

const chartSeries = computed(() => {
  const rows = stats.value?.dailyByProject || []
  if (chartGroup.value !== 'projects' || rows.length < 2) return undefined
  return rows.map((row, i) => ({
    id: row.projectId,
    name: row.projectName,
    color: CHART_COLORS[i % CHART_COLORS.length]!,
    daily: row.daily,
  }))
})

function projectColor(projectId: string) {
  const rows = stats.value?.dailyByProject || []
  const i = rows.findIndex(r => r.projectId === projectId)
  if (i < 0) return null
  return CHART_COLORS[i % CHART_COLORS.length]!
}

function delta(current: number | null | undefined, previous: number | null | undefined) {
  if (current == null || previous == null) return null
  return Math.round((current - previous) * 10) / 10
}

const csatDelta = computed(() => delta(stats.value?.csatPercent, stats.value?.previousCsatPercent))

function reaction(score: number | null) {
  if (score == null || score < 1 || score > 5) return '—'
  return EMOJIS[score - 1]
}

function relativeTime(ms: number) {
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
</script>

<template>
  <UDashboardPanel
    id="home-dashboard"
    :ui="{ body: 'lg:py-10' }"
  >
    <template #header>
      <UDashboardNavbar title="Dashboard">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <USwitch
            v-model="autoRefresh"
            label="Auto-refresh"
            size="sm"
          />
          <UButton
            to="/projects?new=1"
            size="sm"
            label="New project"
            icon="i-lucide-plus"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div
        v-if="statsStatus === 'pending' && !stats"
        class="text-sm text-muted max-w-5xl mx-auto"
      >
        Loading metrics…
      </div>

      <div
        v-else-if="stats"
        class="space-y-6 w-full max-w-5xl mx-auto"
      >
        <div class="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div class="rounded-xl bg-elevated/60 ring-1 ring-default p-4">
            <p class="text-xs font-medium text-muted">
              CSAT
            </p>
            <p class="text-3xl font-semibold tracking-tight text-highlighted mt-1 tabular-nums">
              {{ stats.csatPercent == null ? '—' : `${stats.csatPercent}%` }}
            </p>
            <p
              v-if="csatDelta != null"
              class="text-xs mt-1.5 font-medium"
              :class="csatDelta >= 0 ? 'text-success' : 'text-error'"
            >
              {{ csatDelta >= 0 ? '+' : '' }}{{ csatDelta }} vs previous period
            </p>
            <p
              v-else
              class="text-xs mt-1.5 text-muted"
            >
              All projects · 30 days
            </p>
          </div>
          <div class="rounded-xl bg-elevated/60 ring-1 ring-default p-4">
            <p class="text-xs font-medium text-muted">
              Average
            </p>
            <p class="text-3xl font-semibold tracking-tight text-highlighted mt-1 tabular-nums">
              {{ stats.average == null ? '—' : stats.average }}
            </p>
            <p class="text-xs mt-1.5 text-muted">
              Out of 5
            </p>
          </div>
          <div class="rounded-xl bg-elevated/60 ring-1 ring-default p-4">
            <p class="text-xs font-medium text-muted">
              Responses
            </p>
            <p class="text-3xl font-semibold tracking-tight text-highlighted mt-1 tabular-nums">
              {{ stats.total }}
            </p>
            <p class="text-xs mt-1.5 text-muted">
              {{ stats.previousTotal }} previous period
            </p>
          </div>
          <div class="rounded-xl bg-elevated/60 ring-1 ring-default p-4">
            <p class="text-xs font-medium text-muted">
              With comment
            </p>
            <p class="text-3xl font-semibold tracking-tight text-highlighted mt-1 tabular-nums">
              {{ stats.withComment }}
            </p>
            <p class="text-xs mt-1.5 text-muted">
              {{ stats.total ? Math.round((stats.withComment / stats.total) * 100) : 0 }}% of responses
            </p>
          </div>
        </div>

        <section
          v-if="stats.projects.length"
          class="rounded-xl ring-1 ring-default bg-default p-5 space-y-3"
        >
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold text-highlighted">
              By project
            </h2>
            <UButton
              to="/projects"
              size="xs"
              color="neutral"
              variant="ghost"
              label="Manage"
            />
          </div>
          <ul class="grid gap-2 sm:grid-cols-2">
            <li
              v-for="project in stats.projects"
              :key="project.id"
            >
              <NuxtLink
                :to="`/projects/${project.id}`"
                class="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ring-1 ring-default hover:bg-elevated/50 transition-colors"
              >
                <div class="min-w-0 flex items-start gap-2">
                  <span
                    v-if="projectColor(project.id)"
                    class="mt-1.5 size-2.5 rounded-sm shrink-0 ring-1 ring-black/10 dark:ring-white/15"
                    :style="{ backgroundColor: projectColor(project.id)! }"
                  />
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-highlighted truncate">
                      {{ project.name }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ project.total }} responses · 30d
                    </p>
                  </div>
                </div>
                <p class="text-sm font-semibold tabular-nums shrink-0">
                  {{ project.csatPercent == null ? '—' : `${project.csatPercent}%` }}
                </p>
              </NuxtLink>
            </li>
          </ul>
        </section>

        <div class="grid gap-4 lg:grid-cols-5">
          <section class="lg:col-span-3 rounded-xl ring-1 ring-default bg-default p-5 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="min-w-0">
                <h2 class="text-sm font-semibold text-highlighted">
                  Responses per day
                </h2>
                <p class="text-xs text-muted mt-0.5">
                  {{ chartGroup === 'projects' && (stats.dailyByProject?.length || 0) > 1
                    ? 'Grouped by project · 30 days'
                    : 'All projects · 30 days' }}
                </p>
              </div>
              <UTabs
                v-if="chartGroupReady && (stats.dailyByProject?.length || 0) > 1"
                v-model="chartGroup"
                :default-value="chartGroup"
                :items="chartGroupItems"
                :content="false"
                size="xs"
                color="neutral"
                variant="link"
                class="w-auto shrink-0"
                :ui="{ root: 'w-auto', list: 'w-auto' }"
              />
            </div>
            <DailyChart
              :daily="stats.daily"
              :series="chartSeries"
            />
            <div class="flex flex-wrap gap-1.5 pt-1">
              <span
                v-for="bucket in stats.distribution"
                :key="bucket.score"
                class="inline-flex items-center gap-1 text-xs rounded-full bg-elevated px-2.5 py-1"
              >
                <span>{{ EMOJIS[bucket.score - 1] }}</span>
                <span class="tabular-nums text-muted">{{ bucket.count }}</span>
              </span>
            </div>
          </section>

          <section class="lg:col-span-2 rounded-xl ring-1 ring-default bg-default p-5 space-y-3">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-semibold text-highlighted">
                Live comments
              </h2>
              <span class="text-xs text-muted">Mixed feed</span>
            </div>
            <ul
              v-if="stats.recentComments.length"
              class="divide-y divide-default -mx-1"
            >
              <li
                v-for="item in stats.recentComments.slice(0, 8)"
                :key="item.id"
                class="first:pt-0"
              >
                <NuxtLink
                  :to="`/projects/${item.projectId}/responses?response=${item.id}`"
                  class="block px-1 py-3 rounded-md hover:bg-elevated/60 transition-colors"
                >
                  <div class="flex items-start justify-between gap-2 mb-1">
                    <div class="min-w-0">
                      <span class="text-xs font-medium text-highlighted truncate block">
                        {{ item.projectName }}
                      </span>
                      <span class="text-[11px] font-mono text-muted truncate block">{{ item.urlPath }}</span>
                    </div>
                    <div class="shrink-0 text-right">
                      <span class="text-sm">{{ reaction(item.score) }}</span>
                      <p class="text-[11px] text-muted">
                        {{ relativeTime(item.createdAt) }}
                      </p>
                    </div>
                  </div>
                  <p class="text-sm text-highlighted line-clamp-2">
                    {{ item.comment }}
                  </p>
                </NuxtLink>
              </li>
            </ul>
            <p
              v-else
              class="text-sm text-muted py-6 text-center"
            >
              No comments yet across projects.
            </p>
          </section>
        </div>

        <section class="rounded-xl ring-1 ring-default bg-default p-5 space-y-3">
          <h2 class="text-sm font-semibold text-highlighted">
            Lowest-scoring pages
          </h2>
          <ul
            v-if="stats.worstPages.length"
            class="divide-y divide-default"
          >
            <li
              v-for="page in stats.worstPages"
              :key="`${page.projectId}:${page.path}`"
              class="py-2.5 flex items-center justify-between gap-3 first:pt-0"
            >
              <div class="min-w-0">
                <p class="text-xs text-muted truncate">
                  {{ page.projectName }}
                </p>
                <p class="text-sm truncate">
                  {{ page.path }}
                </p>
              </div>
              <span class="text-sm shrink-0 tabular-nums text-muted">
                {{ page.csatPercent }}% · {{ page.count }} responses
              </span>
            </li>
          </ul>
          <p
            v-else
            class="text-sm text-muted"
          >
            Needs at least 3 responses per page.
          </p>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
