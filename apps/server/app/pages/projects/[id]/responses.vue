<script setup lang="ts">
import type { ProjectDto } from '#shared/projects'
import type { SurveyDto } from '#shared/surveys'
import { DEFAULT_HELPFUL_OPTIONS } from '#shared/surveys'

const EMOJIS = ['😠', '🙁', '😐', '🙂', '😍']

const route = useRoute()
const id = computed(() => String(route.params.id))
const toast = useToast()

const { data: projectData, error } = await useFetch<{ project: ProjectDto }>(
  () => `/api/admin/projects/${id.value}`,
)
if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    statusMessage: error.value.statusMessage || 'Project not found',
  })
}

const { data: surveysData } = await useFetch<{ surveys: SurveyDto[] }>(
  () => `/api/admin/projects/${id.value}/surveys`,
)

const surveysById = computed(() => {
  const map = new Map<string, SurveyDto>()
  for (const s of surveysData.value?.surveys || []) map.set(s.id, s)
  return map
})

const q = ref(typeof route.query.q === 'string' ? route.query.q : '')
const hasComment = ref<'all' | 'yes' | 'no'>(
  route.query.hasComment === 'yes' || route.query.hasComment === 'true'
    ? 'yes'
    : route.query.hasComment === 'no' || route.query.hasComment === 'false'
      ? 'no'
      : 'all',
)
const path = ref(typeof route.query.path === 'string' ? route.query.path : '')
const surveyFilter = ref<string>(
  typeof route.query.surveyId === 'string' ? route.query.surveyId : 'all',
)
/** 0-based page index for the API offset. */
const page = ref(0)
const pageSize = 50

/** 1-based page for UPagination. */
const pageModel = computed({
  get: () => page.value + 1,
  set: (value: number) => {
    page.value = Math.max(0, value - 1)
  },
})

const query = computed(() => {
  const params = new URLSearchParams()
  params.set('limit', String(pageSize))
  params.set('offset', String(page.value * pageSize))
  if (q.value.trim()) params.set('q', q.value.trim())
  if (path.value.trim()) params.set('path', path.value.trim())
  if (hasComment.value === 'yes') params.set('hasComment', 'true')
  if (hasComment.value === 'no') params.set('hasComment', 'false')
  if (surveyFilter.value !== 'all') params.set('surveyId', surveyFilter.value)
  return params.toString()
})

const { data, status, refresh } = await useFetch(
  () => `/api/admin/projects/${id.value}/responses?${query.value}`,
)

watch([q, hasComment, path, surveyFilter], () => {
  page.value = 0
})

const { autoRefresh } = useAutoRefresh(() => refresh())

const totalCount = computed(() => data.value?.total || 0)

const commentHeader = computed(() => {
  const surveys = surveysData.value?.surveys || []
  if (surveyFilter.value !== 'all') {
    const s = surveys.find(x => x.id === surveyFilter.value)
    return s?.followUp?.es || s?.followUp?.en || s?.question.es || 'Response'
  }
  return 'Response'
})

type ResponseRow = {
  id: string
  score: number | null
  comment: string | null
  urlPath: string
  urlHost: string
  device: string | null
  createdAt: number
  screenshotPath: string | null
  surveyId: string
  metadata?: Record<string, unknown>
}

type ResponseMeta = {
  imported?: boolean
  source?: string
  externalId?: string
  externalUrl?: string
  importKey?: string
  hotjarNumber?: string
  hotjarResponseUrl?: string
  country?: string
  browser?: string
  os?: string
}

const selected = ref<ResponseRow | null>(null)

function responseMeta(row: ResponseRow | null | undefined): ResponseMeta {
  const raw = row?.metadata
  if (!raw || typeof raw !== 'object') return {}
  return raw as ResponseMeta
}

function isImported(row: ResponseRow | null | undefined) {
  const m = responseMeta(row)
  return m.imported === true
    || m.source === 'hotjar'
    || m.source === 'generic'
    || !!m.importKey
}

function externalIdOf(row: ResponseRow | null | undefined) {
  const m = responseMeta(row)
  const id = m.externalId || m.hotjarNumber
  return typeof id === 'string' && id ? id : null
}

function externalUrlOf(row: ResponseRow | null | undefined) {
  const m = responseMeta(row)
  const url = m.externalUrl || m.hotjarResponseUrl
  return typeof url === 'string' && url ? url : null
}

function importSourceLabel(row: ResponseRow | null | undefined) {
  const source = responseMeta(row).source
  if (source === 'hotjar') return 'Hotjar'
  if (source === 'generic') return 'CSV'
  return 'Import'
}

async function openResponseById(responseId: string) {
  const fromList = (data.value?.items as ResponseRow[] | undefined)?.find(r => r.id === responseId)
  if (fromList) {
    selected.value = fromList
    return
  }
  try {
    selected.value = await $fetch<ResponseRow>(
      `/api/admin/projects/${id.value}/responses/${responseId}`,
    )
  }
  catch {
    toast.add({ title: 'Response not found', color: 'error' })
    clearResponseQuery()
  }
}

function clearResponseQuery() {
  if (!route.query.response) return
  const next = { ...route.query }
  delete next.response
  navigateTo({ path: route.path, query: next }, { replace: true })
}

function closeSelected() {
  selected.value = null
  clearResponseQuery()
}

watch(
  () => [String(route.query.response || ''), data.value?.items] as const,
  ([responseId]) => {
    if (!responseId) return
    if (selected.value?.id === responseId) return
    void openResponseById(responseId)
  },
  { immediate: true },
)

function exportUrl(format: 'csv' | 'json') {
  const params = new URLSearchParams({ format })
  if (q.value.trim()) params.set('q', q.value.trim())
  if (hasComment.value === 'yes') params.set('hasComment', 'true')
  if (surveyFilter.value !== 'all') params.set('surveyId', surveyFilter.value)
  return `/api/admin/projects/${id.value}/export?${params}`
}

function copyExport(format: 'csv' | 'json') {
  window.location.href = exportUrl(format)
  toast.add({ title: `Downloading ${format.toUpperCase()}`, color: 'success' })
}

const deletingId = ref<string | null>(null)
const importOpen = ref(false)

type ImportJob = {
  id: string
  status: 'queued' | 'running' | 'done' | 'error'
  total: number
  processed: number
  imported: number
  skipped: number
  errors: Array<{ row: number, message: string }>
  errorMessage: string | null
}

const importJob = ref<ImportJob | null>(null)
let importPollTimer: ReturnType<typeof setInterval> | null = null

const importProgress = computed(() => {
  if (!importJob.value?.total) return 0
  return Math.min(100, Math.round((importJob.value.processed / importJob.value.total) * 100))
})

function stopImportPoll() {
  if (importPollTimer) {
    clearInterval(importPollTimer)
    importPollTimer = null
  }
}

async function pollImportJob(jobId: string) {
  try {
    const res = await $fetch<{ job: ImportJob }>(
      `/api/admin/projects/${id.value}/import/${jobId}`,
    )
    importJob.value = res.job
    if (res.job.status === 'done') {
      stopImportPoll()
      toast.add({
        title: `Imported ${res.job.imported} responses`,
        description: res.job.skipped
          ? `${res.job.skipped} duplicates skipped`
          : undefined,
        color: 'success',
      })
      await refresh()
      // Clear banner after a moment
      setTimeout(() => {
        if (importJob.value?.id === jobId && importJob.value.status === 'done') {
          importJob.value = null
        }
      }, 4000)
    }
    else if (res.job.status === 'error') {
      stopImportPoll()
      toast.add({
        title: res.job.errorMessage || 'Import failed',
        color: 'error',
      })
    }
  }
  catch {
    /* keep polling */
  }
}

function onImportStarted(job: ImportJob) {
  importOpen.value = false
  importJob.value = job
  stopImportPoll()
  void pollImportJob(job.id)
  importPollTimer = setInterval(() => {
    void pollImportJob(job.id)
  }, 600)
}

onBeforeUnmount(() => stopImportPoll())


async function removeResponse(row: { id: string, comment: string | null }) {
  const preview = row.comment?.trim()
    ? `“${row.comment.trim().slice(0, 48)}${row.comment.trim().length > 48 ? '…' : ''}”`
    : 'this response'
  if (!confirm(`Delete ${preview}? This cannot be undone.`)) return

  deletingId.value = row.id
  try {
    await $fetch(`/api/admin/projects/${id.value}/responses/${row.id}`, {
      method: 'DELETE',
    })
    if (selected.value?.id === row.id) closeSelected()
    toast.add({ title: 'Response deleted', color: 'success' })
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: err.data?.statusMessage || err.statusMessage || 'Delete failed',
      color: 'error',
    })
  } finally {
    deletingId.value = null
  }
}

function fmt(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function pickI18n(map: Record<string, string> | undefined, locale: string, fallback: string) {
  if (!map) return fallback
  return map[locale] || map.es || map.en || Object.values(map).find(Boolean) || fallback
}

function surveyName(surveyId: string) {
  return surveysById.value.get(surveyId)?.name || surveyId
}

function surveyTypeLabel(surveyId: string) {
  const type = surveysById.value.get(surveyId)?.type
  if (type === 'helpful') return 'Page feedback'
  if (type === 'thumbs') return 'Thumbs'
  if (type === 'csat') return 'Rating'
  return type || ''
}

function reaction(score: number | null, surveyId?: string) {
  if (score == null) return '—'
  const survey = surveyId ? surveysById.value.get(surveyId) : undefined
  if (survey?.type === 'helpful') {
    const options = survey.appearance.options?.length === 4
      ? survey.appearance.options
      : DEFAULT_HELPFUL_OPTIONS
    const opt = options.find(o => o.value === score)
    const locale = survey.appearance.locale || 'es'
    return opt ? pickI18n(opt.label, locale, String(score)) : String(score)
  }
  if (survey?.type === 'thumbs') {
    if (score === 1) return '👍'
    if (score === 0) return '👎'
    return String(score)
  }
  if (score === 0) return '👎'
  if (score >= 1 && score <= 5) return EMOJIS[score - 1]!
  return String(score)
}

function deviceIcon(device: string | null) {
  if (device === 'mobile') return 'i-lucide-smartphone'
  if (device === 'tablet') return 'i-lucide-tablet'
  return 'i-lucide-monitor'
}

const surveyItems = computed(() => [
  { label: 'All surveys', value: 'all' },
  ...(surveysData.value?.surveys || []).map(s => ({
    label: s.name,
    value: s.id,
  })),
])
</script>

<template>
  <UDashboardPanel
    :id="`project-responses-${id}`"
    :ui="{ body: 'flex flex-col min-h-0 overflow-hidden' }"
  >
    <template #header>
      <UDashboardNavbar title="Respondents">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <ResponseImportModal
            v-model:open="importOpen"
            :project-id="id"
            :surveys="surveysData?.surveys || []"
            @started="onImportStarted"
          >
            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              label="Import"
              icon="i-lucide-upload"
            />
          </ResponseImportModal>
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            label="CSV"
            icon="i-lucide-download"
            @click="copyExport('csv')"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            label="JSON"
            icon="i-lucide-download"
            @click="copyExport('json')"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <div class="flex flex-wrap items-center gap-2">
            <USelect
              v-model="surveyFilter"
              :items="surveyItems"
              class="w-44"
              size="sm"
            />
            <UInput
              v-model="path"
              placeholder="Page URL"
              icon="i-lucide-link"
              size="sm"
              class="w-40"
            />
            <UInput
              v-model="q"
              placeholder="Keyword"
              icon="i-lucide-search"
              size="sm"
              class="w-40"
            />
            <USelect
              v-model="hasComment"
              size="sm"
              class="w-36"
              :items="[
                { label: 'All responses', value: 'all' },
                { label: 'With comment', value: 'yes' },
                { label: 'Without comment', value: 'no' },
              ]"
            />
          </div>
        </template>
        <template #right>
          <USwitch
            v-model="autoRefresh"
            label="Auto-refresh"
            size="sm"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-3 min-h-0 h-full">
        <div
          v-if="importJob"
          class="rounded-xl ring-1 ring-default bg-default p-4 space-y-2 shrink-0"
        >
          <div class="flex items-center justify-between gap-3 text-sm">
            <div class="min-w-0">
              <p class="font-medium text-highlighted">
                {{
                  importJob.status === 'done'
                    ? 'Import complete'
                    : importJob.status === 'error'
                      ? 'Import failed'
                      : 'Importing CSV…'
                }}
              </p>
              <p class="text-xs text-muted mt-0.5">
                <template v-if="importJob.status === 'error'">
                  {{ importJob.errorMessage || 'Something went wrong' }}
                </template>
                <template v-else>
                  {{ importJob.imported }} imported
                  · {{ importJob.skipped }} skipped
                  · {{ importJob.processed }} / {{ importJob.total }} rows
                </template>
              </p>
            </div>
            <UButton
              v-if="importJob.status === 'done' || importJob.status === 'error'"
              size="xs"
              color="neutral"
              variant="ghost"
              label="Dismiss"
              @click="importJob = null"
            />
          </div>
          <div class="h-2 rounded-full bg-elevated overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="importJob.status === 'error' ? 'bg-error' : 'bg-primary'"
              :style="{ width: `${importJob.status === 'done' ? 100 : importProgress}%` }"
            />
          </div>
        </div>

        <div
          v-if="status === 'pending' && !data"
          class="text-sm text-muted"
        >
          Loading…
        </div>

        <div
          v-else-if="!data?.items?.length"
          class="rounded-lg border border-dashed border-default p-8 text-center text-muted text-sm"
        >
          No responses match these filters.
        </div>

        <template v-else>
          <div class="min-h-0 flex-1 overflow-auto border border-default rounded-lg bg-default max-h-[calc(100dvh-13rem)]">
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-elevated text-left text-xs text-muted border-b border-default">
                <tr>
                  <th class="px-3 py-2.5 font-medium w-28">
                    Screenshot
                  </th>
                  <th class="px-3 py-2.5 font-medium min-w-56">
                    {{ commentHeader }}
                  </th>
                  <th class="px-3 py-2.5 font-medium">
                    Reaction
                  </th>
                  <th class="px-3 py-2.5 font-medium">
                    Survey
                  </th>
                  <th class="px-3 py-2.5 font-medium">
                    Page
                  </th>
                  <th class="px-3 py-2.5 font-medium">
                    Date
                  </th>
                  <th class="px-3 py-2.5 font-medium">
                    Device
                  </th>
                  <th class="px-3 py-2.5 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="row in data.items"
                  :key="row.id"
                  class="hover:bg-elevated/40 cursor-pointer"
                  :class="{ 'bg-elevated/50': selected?.id === row.id }"
                  @click="selected = row"
                >
                  <td class="px-3 py-2">
                    <img
                      v-if="row.screenshotPath"
                      :src="`/api/admin/projects/${id}/responses/${row.id}/screenshot`"
                      alt=""
                      class="h-14 w-24 object-cover rounded-md border border-default"
                    >
                    <div
                      v-else
                      class="h-14 w-24 rounded-md border border-dashed border-default bg-elevated/50 flex items-center justify-center text-[10px] text-muted"
                    >
                      No shot
                    </div>
                  </td>
                  <td class="px-3 py-2 max-w-md">
                    <p class="whitespace-pre-wrap break-words text-highlighted">
                      {{ row.comment || '—' }}
                    </p>
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap text-sm text-highlighted">
                    {{ reaction(row.score, row.surveyId) }}
                  </td>
                  <td class="px-3 py-2">
                    <div class="min-w-0 max-w-40">
                      <p class="truncate text-highlighted text-sm">
                        {{ surveyName(row.surveyId) }}
                      </p>
                      <p class="text-[11px] text-muted truncate">
                        {{ surveyTypeLabel(row.surveyId) }}
                      </p>
                    </div>
                  </td>
                  <td class="px-3 py-2">
                    <span
                      class="inline-flex items-center gap-1.5 font-mono text-xs text-muted max-w-48 truncate"
                      :title="`${row.urlHost}${row.urlPath}`"
                    >
                      <UIcon
                        name="i-lucide-globe"
                        class="size-3.5 shrink-0"
                      />
                      {{ row.urlPath }}
                    </span>
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap text-muted text-xs">
                    {{ fmt(row.createdAt) }}
                  </td>
                  <td class="px-3 py-2">
                    <UIcon
                      :name="deviceIcon(row.device)"
                      class="size-4 text-muted"
                      :title="row.device || 'desktop'"
                    />
                  </td>
                  <td
                    class="px-3 py-2 text-right"
                    @click.stop
                  >
                    <div class="inline-flex items-center gap-1">
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="soft"
                        label="View"
                        @click="selected = row"
                      />
                      <UButton
                        size="xs"
                        color="error"
                        variant="ghost"
                        icon="i-lucide-trash-2"
                        :loading="deletingId === row.id"
                        :disabled="!!deletingId"
                        @click="removeResponse(row)"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 shrink-0 pt-0.5">
            <p class="text-sm text-muted">
              {{ totalCount }} responses
              <span v-if="projectData">· {{ projectData.project.name }}</span>
            </p>
            <UPagination
              v-if="totalCount > pageSize"
              v-model:page="pageModel"
              :total="totalCount"
              :items-per-page="pageSize"
              :sibling-count="1"
              show-edges
              size="sm"
              color="neutral"
              active-color="primary"
            />
          </div>
        </template>
      </div>

      <USlideover
        :open="!!selected"
        title="Response"
        :ui="{ content: 'max-w-lg' }"
        @update:open="(v: boolean) => { if (!v) closeSelected() }"
      >
        <template #body>
          <div
            v-if="selected"
            class="space-y-4 p-1"
          >
            <img
              v-if="selected.screenshotPath"
              :src="`/api/admin/projects/${id}/responses/${selected.id}/screenshot`"
              alt="Screenshot"
              class="w-full rounded-lg border border-default"
            >
            <div class="space-y-1">
              <p class="text-xs text-muted">
                Survey
              </p>
              <p class="text-sm">
                {{ surveyName(selected.surveyId) }}
                <span class="text-muted">· {{ surveyTypeLabel(selected.surveyId) }}</span>
              </p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted">
                Reaction
              </p>
              <p class="text-lg">
                {{ reaction(selected.score, selected.surveyId) }}
              </p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted">
                Comment
              </p>
              <p class="whitespace-pre-wrap break-words">
                {{ selected.comment || '—' }}
              </p>
            </div>
            <dl class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt class="text-xs text-muted">
                  Page
                </dt>
                <dd class="font-mono text-xs break-all">
                  {{ selected.urlHost }}{{ selected.urlPath }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">
                  Date
                </dt>
                <dd>{{ fmt(selected.createdAt) }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">
                  Device
                </dt>
                <dd class="capitalize">
                  {{ selected.device || 'desktop' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">
                  Id
                </dt>
                <dd class="font-mono text-xs">
                  {{ selected.id }}
                </dd>
              </div>
              <div v-if="responseMeta(selected).country">
                <dt class="text-xs text-muted">
                  Country
                </dt>
                <dd>{{ responseMeta(selected).country }}</dd>
              </div>
              <div v-if="responseMeta(selected).browser || responseMeta(selected).os">
                <dt class="text-xs text-muted">
                  Browser / OS
                </dt>
                <dd class="text-xs">
                  {{ [responseMeta(selected).browser, responseMeta(selected).os].filter(Boolean).join(' · ') }}
                </dd>
              </div>
            </dl>

            <div
              v-if="isImported(selected)"
              class="rounded-lg border border-default bg-elevated/50 px-3 py-2.5 space-y-2"
            >
              <div class="flex flex-wrap items-center gap-2">
                <UBadge
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  :label="`Imported · ${importSourceLabel(selected)}`"
                />
              </div>
              <dl class="grid grid-cols-1 gap-2 text-sm">
                <div v-if="externalIdOf(selected)">
                  <dt class="text-xs text-muted">
                    External id
                  </dt>
                  <dd class="font-mono text-xs">
                    {{ externalIdOf(selected) }}
                  </dd>
                </div>
                <div v-if="externalUrlOf(selected)">
                  <dt class="text-xs text-muted">
                    External URL
                  </dt>
                  <dd>
                    <a
                      :href="externalUrlOf(selected)!"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs text-primary break-all hover:underline"
                    >{{ externalUrlOf(selected) }}</a>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </template>
        <template #footer>
          <UButton
            v-if="selected"
            color="error"
            variant="soft"
            icon="i-lucide-trash-2"
            label="Delete response"
            :loading="deletingId === selected.id"
            :disabled="!!deletingId"
            @click="removeResponse(selected)"
          />
        </template>
      </USlideover>

    </template>
  </UDashboardPanel>
</template>

