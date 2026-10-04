<script setup lang="ts">
import type { ProjectDto } from '../../../../shared/projects'
import type { SurveyDto } from '../../../../shared/surveys'

const route = useRoute()
const id = computed(() => String(route.params.id))
const toast = useToast()

const { error } = await useFetch<{ project: ProjectDto }>(
  () => `/api/admin/projects/${id.value}`,
)
if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    statusMessage: error.value.statusMessage || 'Project not found',
  })
}

const { data, refresh, status } = await useFetch<{ surveys: SurveyDto[] }>(
  () => `/api/admin/projects/${id.value}/surveys`,
)

const creating = ref(false)

async function createSurvey() {
  creating.value = true
  try {
    const { survey } = await $fetch<{ survey: SurveyDto }>(
      `/api/admin/projects/${id.value}/surveys`,
      {
        method: 'POST',
        body: {
          name: 'CSAT',
          type: 'csat',
          question: {
            es: '¿Cómo calificarías tu satisfacción?',
            en: 'How would you rate your satisfaction?',
          },
          followUp: {
            es: 'Déjanos tu comentario sobre tu calificación',
            en: 'Leave a comment about your rating',
          },
          thanks: {
            es: '¡Gracias por tus comentarios!',
            en: 'Thanks for your feedback!',
          },
          appearance: {
            scaleStyle: 'emojis',
            position: 'right',
            button: '#16a34a',
            background: '#ffffff',
            text: '#18181b',
            locale: 'es',
            lowLabel: { es: 'Muy insatisfecho', en: 'Very dissatisfied' },
            highLabel: { es: 'Muy satisfecho', en: 'Very satisfied' },
          },
          trigger: { type: 'manual' },
          frequency: { mode: 'once' },
          targeting: {
            devices: ['desktop', 'tablet', 'mobile'],
            sampleRate: 100,
          },
        },
      },
    )
    toast.add({ title: 'Survey created', color: 'success' })
    await navigateTo(`/projects/${id.value}/surveys/${survey.id}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: err.data?.statusMessage || err.statusMessage || 'Create failed',
      color: 'error',
    })
  } finally {
    creating.value = false
  }
}

async function removeSurvey(survey: SurveyDto) {
  if (!confirm(`Delete “${survey.name}”?`)) return
  await $fetch(`/api/admin/projects/${id.value}/surveys/${survey.id}`, { method: 'DELETE' })
  toast.add({ title: 'Survey deleted', color: 'success' })
  await refresh()
}

function triggerLabel(survey: SurveyDto) {
  const t = survey.trigger
  if (t.type === 'delay') return `After ${Math.round(t.ms / 1000)}s`
  if (t.type === 'scroll') return `On scroll (${t.percent}%)`
  if (t.type === 'pageviews') return `After ${t.count} pages`
  if (t.type === 'immediate') return 'On page load'
  if (t.type === 'exit_intent') return 'On exit'
  if (t.type === 'manual') return 'Manual'
  return t.type
}

function frequencyLabel(survey: SurveyDto) {
  const f = survey.frequency
  if (f.mode === 'until_submit') return 'Until response'
  if (f.mode === 'once') return 'Once'
  if (f.mode === 'always') return 'Always'
  if (f.mode === 'cooldown') return `Every ${f.days}d`
  return f.mode
}

function typeLabel(survey: SurveyDto) {
  return survey.type === 'thumbs' ? 'Thumbs' : 'Rating'
}
</script>

<template>
  <UDashboardPanel
    :id="`project-surveys-${id}`"
    :ui="{ body: 'lg:py-10' }"
  >
    <template #header>
      <UDashboardNavbar title="Surveys">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="New survey"
            icon="i-lucide-plus"
            :loading="creating"
            @click="createSurvey"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full max-w-3xl mx-auto space-y-4">
        <div
          v-if="status === 'pending' && !data"
          class="text-sm text-muted"
        >
          Loading surveys…
        </div>

        <ul
          v-else-if="data?.surveys?.length"
          class="divide-y divide-default border border-default rounded-lg bg-default"
        >
          <li
            v-for="survey in data.surveys"
            :key="survey.id"
            class="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          >
            <NuxtLink
              :to="`/projects/${id}/surveys/${survey.id}`"
              class="min-w-0 space-y-1 flex-1 hover:opacity-80"
            >
              <p class="font-medium text-highlighted truncate">
                {{ survey.name }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ survey.question.es || survey.question.en }}
              </p>
              <p class="text-xs text-muted">
                {{ typeLabel(survey) }} · {{ triggerLabel(survey) }} · {{ frequencyLabel(survey) }}
                · {{ survey.isActive ? 'Active' : 'Off' }}
              </p>
            </NuxtLink>
            <div class="flex gap-2 shrink-0">
              <UButton
                size="sm"
                color="neutral"
                variant="soft"
                label="Edit"
                :to="`/projects/${id}/surveys/${survey.id}`"
              />
              <UButton
                size="sm"
                color="error"
                variant="ghost"
                label="Delete"
                @click="removeSurvey(survey)"
              />
            </div>
          </li>
        </ul>

        <div
          v-else
          class="rounded-lg border border-dashed border-default p-8 text-center space-y-3"
        >
          <p class="text-highlighted font-medium">
            No surveys
          </p>
          <UButton
            label="Create survey"
            :loading="creating"
            @click="createSurvey"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
