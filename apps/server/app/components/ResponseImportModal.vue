<script setup lang="ts">
import type { SurveyDto } from '#shared/surveys'
import {
  isHotjarExport,
  parseCsv,
  suggestCsvMapping,
  type CsvImportMapping,
} from '#shared/csv-import'

export type ImportJob = {
  id: string
  status: 'queued' | 'running' | 'done' | 'error'
  total: number
  processed: number
  imported: number
  skipped: number
  errors: Array<{ row: number, message: string }>
  errorMessage: string | null
  detected: string | null
}

const props = defineProps<{
  projectId: string
  surveys: SurveyDto[]
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  started: [job: ImportJob]
}>()

const toast = useToast()
const step = ref<'upload' | 'map'>('upload')
const pending = ref(false)
const csvText = ref('')
const fileName = ref('')
const headers = ref<string[]>([])
const previewRows = ref<Record<string, string>[]>([])
const rowCount = ref(0)
const mapping = ref<CsvImportMapping>({
  score: '',
  comment: '',
  date: '',
  url: '',
  device: '',
  visitor: '',
})
const surveyId = ref('')
const hotjar = ref(false)

const headerItems = computed(() => [
  { label: '— skip —', value: '' },
  ...headers.value.map(h => ({ label: h, value: h })),
])

const surveyItems = computed(() =>
  props.surveys.map(s => ({
    label: `${s.name} (${s.type})`,
    value: s.id,
  })),
)

const csatSurveys = computed(() => props.surveys.filter(s => s.type === 'csat'))

function reset() {
  step.value = 'upload'
  pending.value = false
  csvText.value = ''
  fileName.value = ''
  headers.value = []
  previewRows.value = []
  rowCount.value = 0
  mapping.value = {
    score: '',
    comment: '',
    date: '',
    url: '',
    device: '',
    visitor: '',
  }
  surveyId.value = csatSurveys.value[0]?.id || props.surveys[0]?.id || ''
  hotjar.value = false
}

watch(open, (v) => {
  if (v) reset()
})

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    toast.add({ title: 'File larger than 5MB', color: 'error' })
    return
  }
  fileName.value = file.name
  csvText.value = await file.text()
  const parsed = parseCsv(csvText.value)
  if (!parsed.headers.length) {
    toast.add({ title: 'Could not read CSV headers', color: 'error' })
    return
  }
  headers.value = parsed.headers
  previewRows.value = parsed.records.slice(0, 5)
  rowCount.value = parsed.records.length
  mapping.value = suggestCsvMapping(parsed.headers)
  hotjar.value = isHotjarExport(parsed.headers)
  if (!surveyId.value) {
    surveyId.value = csatSurveys.value[0]?.id || props.surveys[0]?.id || ''
  }
  step.value = 'map'
}

function scrubImportDialog() {
  // Nuxt UI / Reka can leave a data-state=closed dialog mounted and fully visible
  // after programmatic close. Remove only this import dialog from the portal.
  for (const el of document.querySelectorAll('[role="dialog"]')) {
    if (!el.textContent?.includes('Import CSV')) continue
    const portal = el.parentElement
    el.remove()
    if (portal && !portal.querySelector('[role="dialog"]')) {
      portal.querySelectorAll('[data-slot="overlay"]').forEach(o => o.remove())
      if (!portal.childElementCount) portal.remove()
    }
  }
}

function dismiss(close?: () => void) {
  close?.()
  open.value = false
  nextTick(() => {
    requestAnimationFrame(() => scrubImportDialog())
  })
}

async function runImport(close: () => void) {
  if (!mapping.value.score) {
    toast.add({ title: 'Pick a score column', color: 'error' })
    return
  }
  if (!surveyId.value) {
    toast.add({ title: 'Pick a survey', color: 'error' })
    return
  }

  pending.value = true
  try {
    const res = await $fetch<{ job: ImportJob }>(
      `/api/admin/projects/${props.projectId}/import`,
      {
        method: 'POST',
        body: {
          csv: csvText.value,
          surveyId: surveyId.value,
          mapping: mapping.value,
        },
      },
    )
    const created = res?.job
    if (!created?.id) {
      throw new Error('Import job was not created')
    }
    dismiss(close)
    emit('started', created)
    toast.add({
      title: 'Import started',
      description: `Processing ${created.total} rows in the background`,
      color: 'success',
    })
  }
  catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string, message?: string }
    toast.add({
      title: err.data?.statusMessage || err.statusMessage || err.message || 'Import failed',
      color: 'error',
    })
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <!-- Default slot = trigger (Nuxt UI Modal Presence expects a trigger). -->
  <UModal
    v-model:open="open"
    title="Import CSV"
    description="Map a Hotjar (or similar) survey export into this project"
    :transition="false"
    :unmount-on-hide="true"
    :ui="{ content: 'sm:max-w-2xl', footer: 'justify-end' }"
    @after:leave="scrubImportDialog"
  >
    <slot>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-upload"
        label="Import"
      />
    </slot>

    <template #body>
      <div
        v-if="step === 'upload'"
        class="space-y-4"
      >
        <p class="text-sm text-muted">
          Export responses from Hotjar as CSV, then upload the file. Import runs in the background.
        </p>
        <label
          class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-default bg-elevated/40 px-6 py-10 cursor-pointer hover:bg-elevated/70 transition-colors"
        >
          <UIcon
            name="i-lucide-upload"
            class="size-8 text-muted"
          />
          <span class="text-sm font-medium text-highlighted">Choose CSV file</span>
          <span class="text-xs text-muted">Max 5MB · up to 5000 rows</span>
          <input
            type="file"
            accept=".csv,text/csv"
            class="sr-only"
            @change="onFile"
          >
        </label>
      </div>

      <div
        v-else
        class="space-y-5"
      >
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span class="font-medium text-highlighted truncate">{{ fileName }}</span>
          <span class="text-muted">· {{ rowCount }} rows</span>
          <UBadge
            v-if="hotjar"
            color="success"
            variant="subtle"
            label="Hotjar detected"
            size="sm"
          />
        </div>

        <UFormField
          label="Target survey"
          description="Responses will be attached to this survey"
        >
          <USelect
            v-model="surveyId"
            :items="surveyItems"
            class="w-full"
          />
        </UFormField>

        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField
            label="Score"
            required
          >
            <USelect
              v-model="mapping.score"
              :items="headerItems.filter(i => i.value)"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Comment">
            <USelect
              v-model="mapping.comment"
              :items="headerItems"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Date submitted">
            <USelect
              v-model="mapping.date"
              :items="headerItems"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Page URL">
            <USelect
              v-model="mapping.url"
              :items="headerItems"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Device">
            <USelect
              v-model="mapping.device"
              :items="headerItems"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Visitor ID">
            <USelect
              v-model="mapping.visitor"
              :items="headerItems"
              class="w-full"
            />
          </UFormField>
        </div>

        <div
          v-if="previewRows.length"
          class="rounded-lg border border-default overflow-x-auto"
        >
          <p class="text-xs font-medium text-muted px-3 py-2 border-b border-default">
            Preview (first {{ previewRows.length }})
          </p>
          <table class="min-w-full text-xs">
            <thead class="bg-elevated/50 text-muted">
              <tr>
                <th class="px-2 py-1.5 text-left font-medium">
                  Score
                </th>
                <th class="px-2 py-1.5 text-left font-medium">
                  Comment
                </th>
                <th class="px-2 py-1.5 text-left font-medium">
                  Page
                </th>
                <th class="px-2 py-1.5 text-left font-medium">
                  Date
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="(row, i) in previewRows"
                :key="i"
              >
                <td class="px-2 py-1.5 tabular-nums">
                  {{ mapping.score ? row[mapping.score] : '—' }}
                </td>
                <td class="px-2 py-1.5 max-w-48 truncate">
                  {{ mapping.comment ? (row[mapping.comment] || '—') : '—' }}
                </td>
                <td class="px-2 py-1.5 max-w-40 truncate font-mono">
                  {{ mapping.url ? row[mapping.url] : '—' }}
                </td>
                <td class="px-2 py-1.5 whitespace-nowrap">
                  {{ mapping.date ? row[mapping.date] : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <UButton
        v-if="step === 'map'"
        color="neutral"
        variant="ghost"
        label="Back"
        :disabled="pending"
        @click="step = 'upload'"
      />
      <UButton
        color="neutral"
        variant="outline"
        label="Cancel"
        :disabled="pending"
        @click="dismiss(close)"
      />
      <UButton
        v-if="step === 'map'"
        label="Start import"
        icon="i-lucide-upload"
        :loading="pending"
        @click="runImport(close)"
      />
    </template>
  </UModal>
</template>
