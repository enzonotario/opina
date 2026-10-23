<script setup lang="ts">
import type { SurveyDto } from '#shared/surveys'
import { DEFAULT_HELPFUL_OPTIONS } from '#shared/surveys'

const props = defineProps<{
  projectId: string | null
  responseId: string | null
}>()

const emit = defineEmits<{
  close: []
  deleted: []
}>()

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
  region?: string
  city?: string
  browser?: string
  os?: string
  resolution?: string
}

const EMOJIS = ['😠', '🙁', '😐', '🙂', '😍']

const toast = useToast()
const detail = ref<ResponseRow | null>(null)
const surveys = ref<SurveyDto[]>([])
const surveysFor = ref<string | null>(null)
const loading = ref(false)
const deleting = ref(false)
let request = 0

const open = computed(() => !!props.projectId && !!props.responseId)

const survey = computed(() => {
  const id = detail.value?.surveyId
  return id ? surveys.value.find(s => s.id === id) : undefined
})

watch(
  () => [props.projectId, props.responseId] as const,
  async ([projectId, responseId]) => {
    const token = ++request
    if (!projectId || !responseId) {
      detail.value = null
      return
    }
    loading.value = true
    try {
      const surveyPromise = surveysFor.value === projectId
        ? Promise.resolve(null)
        : $fetch<{ surveys: SurveyDto[] }>(`/api/admin/projects/${projectId}/surveys`)
      const [row, surveyPayload] = await Promise.all([
        $fetch<ResponseRow>(`/api/admin/projects/${projectId}/responses/${responseId}`),
        surveyPromise,
      ])
      if (token !== request) return
      if (surveyPayload) {
        surveys.value = surveyPayload.surveys
        surveysFor.value = projectId
      }
      detail.value = row
    }
    catch {
      if (token !== request) return
      detail.value = null
      toast.add({ title: 'Response not found', color: 'error' })
      emit('close')
    }
    finally {
      if (token === request) loading.value = false
    }
  },
  { immediate: true },
)

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

function pickI18n(map: Record<string, string> | undefined, locale: string, fallback: string) {
  if (!map) return fallback
  return map[locale] || map.es || map.en || Object.values(map).find(Boolean) || fallback
}

function surveyTypeLabel(type: string | undefined) {
  if (type === 'helpful') return 'Page feedback'
  if (type === 'thumbs') return 'Thumbs'
  if (type === 'csat') return 'Rating'
  return type || ''
}

function reaction(score: number | null) {
  if (score == null) return '—'
  const current = survey.value
  if (current?.type === 'helpful') {
    const options = current.appearance.options?.length === 4
      ? current.appearance.options
      : DEFAULT_HELPFUL_OPTIONS
    const opt = options.find(o => o.value === score)
    const locale = current.appearance.locale || 'es'
    return opt ? pickI18n(opt.label, locale, String(score)) : String(score)
  }
  if (current?.type === 'thumbs') {
    if (score === 1) return '👍'
    if (score === 0) return '👎'
    return String(score)
  }
  if (score === 0) return '👎'
  if (score >= 1 && score <= 5) return EMOJIS[score - 1]!
  return String(score)
}

function fmt(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function removeResponse() {
  const row = detail.value
  const projectId = props.projectId
  if (!row || !projectId) return
  const preview = row.comment?.trim()
    ? `“${row.comment.trim().slice(0, 48)}${row.comment.trim().length > 48 ? '…' : ''}”`
    : 'this response'
  if (!confirm(`Delete ${preview}? This cannot be undone.`)) return

  deleting.value = true
  try {
    await $fetch(`/api/admin/projects/${projectId}/responses/${row.id}`, { method: 'DELETE' })
    toast.add({ title: 'Response deleted', color: 'success' })
    emit('deleted')
    emit('close')
  }
  catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: err.data?.statusMessage || err.statusMessage || 'Delete failed',
      color: 'error',
    })
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <USlideover
    :open="open"
    title="Response"
    :ui="{ content: 'max-w-lg' }"
    @update:open="(v: boolean) => { if (!v) emit('close') }"
  >
    <template #body>
      <div
        v-if="loading && !detail"
        class="text-sm text-muted py-8 text-center"
      >
        Loading…
      </div>
      <div
        v-else-if="detail && projectId"
        class="space-y-4 p-1"
      >
        <img
          v-if="detail.screenshotPath"
          :src="`/api/admin/projects/${projectId}/responses/${detail.id}/screenshot`"
          alt="Screenshot"
          class="w-full rounded-lg border border-default"
        >
        <div class="space-y-1">
          <p class="text-xs text-muted">
            Survey
          </p>
          <p class="text-sm">
            {{ survey?.name || detail.surveyId }}
            <span class="text-muted">· {{ surveyTypeLabel(survey?.type) }}</span>
          </p>
        </div>
        <div class="space-y-1">
          <p class="text-xs text-muted">
            Reaction
          </p>
          <p class="text-lg">
            {{ reaction(detail.score) }}
          </p>
        </div>
        <div class="space-y-1">
          <p class="text-xs text-muted">
            Comment
          </p>
          <p class="whitespace-pre-wrap break-words">
            {{ detail.comment || '—' }}
          </p>
        </div>
        <dl class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="text-xs text-muted">
              Page
            </dt>
            <dd class="font-mono text-xs break-all">
              {{ detail.urlHost }}{{ detail.urlPath }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              Date
            </dt>
            <dd>{{ fmt(detail.createdAt) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              Device
            </dt>
            <dd class="capitalize">
              {{ detail.device || 'desktop' }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              Id
            </dt>
            <dd class="font-mono text-xs">
              {{ detail.id }}
            </dd>
          </div>
          <div v-if="responseMeta(detail).country || responseMeta(detail).region || responseMeta(detail).city">
            <dt class="text-xs text-muted">
              Location
            </dt>
            <dd class="text-xs">
              {{
                [
                  responseMeta(detail).city,
                  responseMeta(detail).region,
                  responseMeta(detail).country,
                ].filter(Boolean).join(', ')
              }}
            </dd>
          </div>
          <div v-if="responseMeta(detail).browser || responseMeta(detail).os">
            <dt class="text-xs text-muted">
              Browser / OS
            </dt>
            <dd class="text-xs">
              {{ [responseMeta(detail).browser, responseMeta(detail).os].filter(Boolean).join(' · ') }}
            </dd>
          </div>
          <div v-if="responseMeta(detail).resolution">
            <dt class="text-xs text-muted">
              Resolution
            </dt>
            <dd class="font-mono text-xs">
              {{ responseMeta(detail).resolution }}
            </dd>
          </div>
        </dl>

        <div
          v-if="isImported(detail)"
          class="rounded-lg border border-default bg-elevated/50 px-3 py-2.5 space-y-2"
        >
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
              :label="`Imported · ${importSourceLabel(detail)}`"
            />
          </div>
          <dl class="grid grid-cols-1 gap-2 text-sm">
            <div v-if="externalIdOf(detail)">
              <dt class="text-xs text-muted">
                External id
              </dt>
              <dd class="font-mono text-xs">
                {{ externalIdOf(detail) }}
              </dd>
            </div>
            <div v-if="externalUrlOf(detail)">
              <dt class="text-xs text-muted">
                External URL
              </dt>
              <dd>
                <a
                  :href="externalUrlOf(detail)!"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-primary break-all hover:underline"
                >{{ externalUrlOf(detail) }}</a>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </template>
    <template #footer>
      <UButton
        v-if="detail"
        color="error"
        variant="soft"
        icon="i-lucide-trash-2"
        label="Delete response"
        :loading="deleting"
        :disabled="deleting"
        @click="removeResponse"
      />
    </template>
  </USlideover>
</template>
