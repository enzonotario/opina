<script setup lang="ts">
import type { ProjectDto } from '../../../shared/projects'

type StatsPayload = {
  csatPercent: number | null
  previousCsatPercent: number | null
  average: number | null
  total: number
  previousTotal: number
  withComment: number
  thumbsPositivePercent: number | null
  distribution: Array<{ score: number, count: number }>
  daily: Array<{ day: string, count: number, csatPercent: number | null }>
  worstPages: Array<{ path: string, count: number, csatPercent: number | null }>
  recentComments: Array<{
    id: string
    score: number | null
    comment: string
    urlPath: string
    createdAt: number
  }>
}

const EMOJIS = ['😠', '🙁', '😐', '🙂', '😍']

const route = useRoute()
const id = computed(() => String(route.params.id))

const { data, error } = await useFetch<{ project: ProjectDto }>(
  () => `/api/admin/projects/${id.value}`,
)

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    statusMessage: error.value.statusMessage || 'Project not found',
  })
}

const project = computed(() => data.value!.project)

const { data: statsData, status: statsStatus } = await useFetch<{ stats: StatsPayload }>(
  () => `/api/admin/projects/${id.value}/stats?days=30`,
)

const stats = computed(() => statsData.value?.stats)

function delta(current: number | null | undefined, previous: number | null | undefined) {
  if (current == null || previous == null) return null
  return Math.round((current - previous) * 10) / 10
}

const csatDelta = computed(() => delta(stats.value?.csatPercent, stats.value?.previousCsatPercent))

function reaction(score: number | null) {
  if (score == null || score < 1 || score > 5) return '—'
  return EMOJIS[score - 1]
}
</script>

<template>
  <UDashboardPanel
    :id="`project-${project.id}`"
    :ui="{ body: 'lg:py-10' }"
  >
    <template #header>
      <UDashboardNavbar :title="project.name">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            :to="`/projects/${project.id}/responses`"
            size="sm"
            color="neutral"
            variant="outline"
            label="Responses"
            icon="i-lucide-messages-square"
          />
          <UButton
            :to="`/projects/${project.id}/surveys`"
            size="sm"
            label="Surveys"
            icon="i-lucide-list-checks"
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
              Last 30 days
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

        <div class="grid gap-4 lg:grid-cols-5">
          <section class="lg:col-span-3 rounded-xl ring-1 ring-default bg-default p-5 space-y-4">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-sm font-semibold text-highlighted">
                Responses per day
              </h2>
              <span class="text-xs text-muted">30 days</span>
            </div>
            <DailyChart :daily="stats.daily" />
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
                Recent comments
              </h2>
              <UButton
                :to="`/projects/${project.id}/responses`"
                size="xs"
                color="neutral"
                variant="ghost"
                label="View all"
              />
            </div>
            <ul
              v-if="stats.recentComments.length"
              class="divide-y divide-default -mx-1"
            >
              <li
                v-for="item in stats.recentComments.slice(0, 6)"
                :key="item.id"
                class="px-1 py-3 first:pt-0"
              >
                <div class="flex items-start justify-between gap-2 mb-1">
                  <span class="text-[11px] font-mono text-muted truncate">{{ item.urlPath }}</span>
                  <span class="text-sm shrink-0">{{ reaction(item.score) }}</span>
                </div>
                <p class="text-sm text-highlighted line-clamp-2">
                  {{ item.comment }}
                </p>
              </li>
            </ul>
            <p
              v-else
              class="text-sm text-muted py-6 text-center"
            >
              No comments yet
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
              :key="page.path"
              class="py-2.5 flex items-center justify-between gap-3 first:pt-0"
            >
              <span class="text-sm truncate">{{ page.path }}</span>
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
