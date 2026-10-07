<script setup lang="ts">
import type { SurveyDto } from '#shared/surveys'
import {
  isHotjarExport,
  parseCsv,
  suggestCsvMapping,
  type CsvImportMapping,
} from '#shared/csv-import'

const props = defineProps<{
  projectId: string
  surveys: SurveyDto[]
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  imported: []
}>()

const toast = useToast()
const step = ref<'upload' | 'map' | 'done'>('upload')
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
const result = ref<{
  imported: number
  skipped: number
  errors: Array<{ row: number, message: string }>
  detected: string
} | null>(null)

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

watch(open, (v) => {
  if (!v) return
  reset()
})

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
  result.value = null
}

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

async function runImport() {
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
    result.value = await $fetch(`/api/admin/projects/${props.projectId}/import`, {
      method: 'POST',
      body: {
        csv: csvText.value,
        surveyId: surveyId.value,
        mapping: mapping.value,
      },
    })
    step.value = 'done'
    toast.add({
      title: `Imported ${result.value.imported} responses`,
      description: result.value.skipped
        ? `${result.value.skipped} duplicates skipped`
        : undefined,
      color: 'success',
    })
    emit('imported')
  }
  catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: err.data?.statusMessage || err.statusMessage || 'Import failed',
      color: 'error',
    })
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Import CSV"
    description="Map a Hotjar (or similar) survey export into this project"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div
        v-if="step === 'upload'"
        class="space-y-4"
      >
        <p class="text-sm text-muted">
          Export responses from Hotjar as CSV, then upload the file. We’ll auto-map common columns.
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
        v-else-if="step === 'map'"
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

      <div
        v-else
        class="space-y-3"
      >
        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-lg bg-elevated/60 ring-1 ring-default p-3 text-center">
            <p class="text-2xl font-semibold tabular-nums text-highlighted">
              {{ result?.imported ?? 0 }}
            </p>
            <p class="text-xs text-muted mt-1">
              Imported
            </p>
          </div>
          <div class="rounded-lg bg-elevated/60 ring-1 ring-default p-3 text-center">
            <p class="text-2xl font-semibold tabular-nums text-highlighted">
              {{ result?.skipped ?? 0 }}
            </p>
            <p class="text-xs text-muted mt-1">
              Skipped (dupes)
            </p>
          </div>
          <div class="rounded-lg bg-elevated/60 ring-1 ring-default p-3 text-center">
            <p class="text-2xl font-semibold tabular-nums text-highlighted">
              {{ result?.errors.length ?? 0 }}
            </p>
            <p class="text-xs text-muted mt-1">
              Row errors
            </p>
          </div>
        </div>
        <ul
          v-if="result?.errors.length"
          class="text-xs text-muted space-y-1 max-h-40 overflow-y-auto"
        >
          <li
            v-for="(err, i) in result.errors"
            :key="i"
          >
            Row {{ err.row }}: {{ err.message }}
          </li>
        </ul>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          v-if="step === 'map'"
          color="neutral"
          variant="ghost"
          label="Back"
          @click="step = 'upload'"
        />
        <UButton
          color="neutral"
          variant="ghost"
          :label="step === 'done' ? 'Close' : 'Cancel'"
          @click="open = false"
        />
        <UButton
          v-if="step === 'map'"
          label="Import"
          icon="i-lucide-upload"
          :loading="pending"
          @click="runImport"
        />
      </div>
    </template>
  </UModal>
</template>
