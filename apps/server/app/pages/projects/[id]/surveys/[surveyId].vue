<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type {
  SurveyAppearance,
  SurveyDto,
  SurveyFrequency,
  SurveyTrigger,
} from '#shared/surveys'
import { DEFAULT_APPEARANCE } from '#shared/surveys'

const route = useRoute()
const projectId = computed(() => String(route.params.id))
const surveyId = computed(() => String(route.params.surveyId))
const toast = useToast()

const { data, error, refresh } = await useFetch<{ survey: SurveyDto }>(
  () => `/api/admin/projects/${projectId.value}/surveys/${surveyId.value}`,
)

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    statusMessage: error.value.statusMessage || 'Survey not found',
  })
}

const tab = ref<'questions' | 'appearance' | 'targeting' | 'behavior'>('questions')
const previewStep = ref<'rating' | 'comment' | 'thanks'>('rating')
const pending = ref(false)
const formError = ref('')

const AVAILABLE_LOCALES = [
  { code: 'es', label: 'Spanish' },
  { code: 'en', label: 'English' },
] as const

const localeTabLabels: Record<string, string> = {
  es: 'ES',
  en: 'EN',
}

function toI18nMap(
  source: Record<string, string> | null | undefined,
  defaults: Record<string, string> = {},
) {
  return ref<Record<string, string>>({ ...defaults, ...(source || {}) })
}

function initialEnabledLocales(survey: SurveyDto): string[] {
  const found = new Set<string>()
  for (const map of [
    survey.question,
    survey.followUp,
    survey.thanks,
    survey.appearance.lowLabel,
    survey.appearance.highLabel,
  ]) {
    if (!map) continue
    for (const code of Object.keys(map)) {
      if (AVAILABLE_LOCALES.some(locale => locale.code === code)) found.add(code)
    }
  }
  if (found.size === 0) return ['es', 'en']
  return AVAILABLE_LOCALES.map(locale => locale.code).filter(code => found.has(code))
}

const name = ref(data.value!.survey.name)
const type = ref<'csat' | 'thumbs'>(data.value!.survey.type === 'thumbs' ? 'thumbs' : 'csat')
const question = toI18nMap(data.value!.survey.question)
const followUp = toI18nMap(data.value!.survey.followUp)
const thanks = toI18nMap(data.value!.survey.thanks, {
  es: '¡Gracias por tus comentarios!',
  en: 'Thanks for your feedback!',
})
const isActive = ref(data.value!.survey.isActive)
const enabledLocales = ref(initialEnabledLocales(data.value!.survey))

const appearance = reactive<SurveyAppearance>({
  ...DEFAULT_APPEARANCE,
  ...data.value!.survey.appearance,
  lowLabel: { ...DEFAULT_APPEARANCE.lowLabel, ...data.value!.survey.appearance.lowLabel },
  highLabel: { ...DEFAULT_APPEARANCE.highLabel, ...data.value!.survey.appearance.highLabel },
})

if (!enabledLocales.value.includes(appearance.locale || 'es')) {
  appearance.locale = enabledLocales.value[0] || 'es'
}

const localeSelectItems = computed(() =>
  AVAILABLE_LOCALES
    .filter(locale => enabledLocales.value.includes(locale.code))
    .map(locale => ({ label: locale.label, value: locale.code })),
)

const localeCheckboxItems = computed(() =>
  AVAILABLE_LOCALES.map(locale => ({
    label: locale.label,
    value: locale.code,
  })),
)

const selectedLocales = computed({
  get: () => enabledLocales.value,
  set: (value: string[]) => {
    const next = AVAILABLE_LOCALES
      .map(locale => locale.code)
      .filter(code => value.includes(code))
    if (!next.length) return
    enabledLocales.value = next
  },
})

watch(enabledLocales, (locales) => {
  if (!locales.includes(appearance.locale || '')) {
    appearance.locale = locales[0] || 'es'
  }
})

function pickEnabled(map: Record<string, string>) {
  const out: Record<string, string> = {}
  for (const code of enabledLocales.value) {
    const value = (map[code] || '').trim()
    if (value) out[code] = value
  }
  return out
}

function pickText(map: Record<string, string>) {
  const locale = appearance.locale || enabledLocales.value[0] || 'es'
  return map[locale] || map.es || map.en || Object.values(map).find(Boolean) || ''
}

const previewQuestion = computed(() => pickText(question.value))
const previewFollowUp = computed(() => pickText(followUp.value))
const previewThanks = computed(() => pickText(thanks.value))

const triggerType = ref<SurveyTrigger['type']>(data.value!.survey.trigger.type)
const triggerMs = ref(
  data.value!.survey.trigger.type === 'delay'
    ? Math.round(Number(data.value!.survey.trigger.ms) / 1000)
    : 5,
)
const triggerPercent = ref(
  data.value!.survey.trigger.type === 'scroll'
    ? Number(data.value!.survey.trigger.percent)
    : 50,
)
const triggerCount = ref(
  data.value!.survey.trigger.type === 'pageviews'
    ? Number(data.value!.survey.trigger.count)
    : 3,
)

const includePaths = ref((data.value!.survey.targeting.include || []).join('\n'))
const excludePaths = ref((data.value!.survey.targeting.exclude || []).join('\n'))
const pagesMode = ref<'all' | 'specific'>(
  (data.value!.survey.targeting.include || []).length ? 'specific' : 'all',
)
const sampleRate = ref(data.value!.survey.targeting.sampleRate ?? 100)
const trafficMode = ref<'all' | 'sample'>(
  (data.value!.survey.targeting.sampleRate ?? 100) >= 100 ? 'all' : 'sample',
)
const devices = ref<Array<'desktop' | 'tablet' | 'mobile'>>(
  [...(data.value!.survey.targeting.devices || ['desktop', 'tablet', 'mobile'])],
)

const deviceLabels: Record<'desktop' | 'tablet' | 'mobile', string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
}

const freqMode = ref<SurveyFrequency['mode']>(data.value!.survey.frequency.mode)
const freqDays = ref(
  data.value!.survey.frequency.mode === 'cooldown'
    ? data.value!.survey.frequency.days
    : 30,
)

const colorPresets = [
  '#ffffff', '#18181b', '#fef08a', '#fdba74', '#86efac',
  '#93c5fd', '#c4b5fd', '#f9a8d4', '#fca5a5', '#2dd4bf',
]

function lines(value: string) {
  return value.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
}

function buildTrigger(): SurveyTrigger {
  switch (triggerType.value) {
    case 'immediate': return { type: 'immediate' }
    case 'delay': return { type: 'delay', ms: Math.max(0, triggerMs.value) * 1000 }
    case 'scroll': return { type: 'scroll', percent: triggerPercent.value }
    case 'exit_intent': return { type: 'exit_intent' }
    case 'pageviews': return { type: 'pageviews', count: triggerCount.value }
    default: return { type: 'manual' }
  }
}

function buildFrequency(): SurveyFrequency {
  if (freqMode.value === 'cooldown') return { mode: 'cooldown', days: freqDays.value }
  return { mode: freqMode.value as 'until_submit' | 'once' | 'always' }
}

function buildBody() {
  const questionMap = pickEnabled(question.value)
  const followUpMap = pickEnabled(followUp.value)
  const thanksMap = pickEnabled(thanks.value)
  const lowLabel = pickEnabled(appearance.lowLabel || {})
  const highLabel = pickEnabled(appearance.highLabel || {})
  const locale = enabledLocales.value.includes(appearance.locale || '')
    ? appearance.locale
    : enabledLocales.value[0] || 'es'

  return {
    name: name.value.trim() || 'Survey',
    type: type.value,
    question: questionMap,
    followUp: Object.keys(followUpMap).length ? followUpMap : null,
    thanks: Object.keys(thanksMap).length ? thanksMap : null,
    appearance: {
      ...appearance,
      lowLabel: Object.keys(lowLabel).length ? lowLabel : { [locale!]: '' },
      highLabel: Object.keys(highLabel).length ? highLabel : { [locale!]: '' },
      locale,
    },
    trigger: buildTrigger(),
    targeting: {
      include: pagesMode.value === 'specific' ? lines(includePaths.value) : [],
      exclude: lines(excludePaths.value),
      sampleRate: trafficMode.value === 'all' ? 100 : sampleRate.value,
      devices: devices.value,
    },
    frequency: buildFrequency(),
    isActive: isActive.value,
  }
}

async function save() {
  pending.value = true
  formError.value = ''
  try {
    await $fetch(
      `/api/admin/projects/${projectId.value}/surveys/${surveyId.value}`,
      { method: 'PATCH', body: buildBody() },
    )
    await refresh()
    toast.add({ title: 'Survey saved', color: 'success' })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
    formError.value = err.data?.statusMessage || err.statusMessage || 'Save failed'
  } finally {
    pending.value = false
  }
}

const tabLinks = computed(() => [[{
  label: 'Questions',
  icon: 'i-lucide-message-circle-question',
  active: tab.value === 'questions',
  onSelect: () => { tab.value = 'questions' },
}, {
  label: 'Appearance',
  icon: 'i-lucide-palette',
  active: tab.value === 'appearance',
  onSelect: () => { tab.value = 'appearance' },
}, {
  label: 'Targeting',
  icon: 'i-lucide-crosshair',
  active: tab.value === 'targeting',
  onSelect: () => { tab.value = 'targeting' },
}, {
  label: 'Behavior',
  icon: 'i-lucide-zap',
  active: tab.value === 'behavior',
  onSelect: () => { tab.value = 'behavior' },
}]] satisfies NavigationMenuItem[][])
</script>

<template>
  <UDashboardPanel
    :id="`survey-edit-${surveyId}`"
    :ui="{ body: 'lg:py-10' }"
  >
    <template #header>
      <UDashboardNavbar :title="name || 'Edit survey'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            :to="`/projects/${projectId}/surveys`"
            color="neutral"
            variant="ghost"
            label="Back"
          />
          <UButton
            label="Save"
            icon="i-lucide-check"
            :loading="pending"
            @click="save"
          />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <UNavigationMenu
          :items="tabLinks"
          highlight
          class="-mx-1 flex-1"
        />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="w-full max-w-5xl mx-auto space-y-4">
        <UAlert
          v-if="formError"
          color="error"
          variant="subtle"
          :title="formError"
        />

        <div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <div class="space-y-5 min-w-0 max-w-2xl">
            <template v-if="tab === 'questions'">
              <UFormField
                label="Active"
                description="Inactive surveys are hidden from visitors"
              >
                <USwitch v-model="isActive" />
              </UFormField>

              <UFormField
                label="Languages"
                description="Texts below can be edited for each selected language"
              >
                <UCheckboxGroup
                  v-model="selectedLocales"
                  :items="localeCheckboxItems"
                  orientation="horizontal"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                label="Survey name"
                hint="Only you see this name"
                required
              >
                <UInput
                  v-model="name"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Question type">
                <USelect
                  v-model="type"
                  class="w-full"
                  :items="[
                    { label: 'Rating scale', value: 'csat' },
                    { label: 'Thumbs up / down', value: 'thumbs' },
                  ]"
                />
              </UFormField>

              <div class="rounded-lg border border-default p-4 space-y-3 bg-default">
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium">
                    1. Rating
                  </p>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    label="Preview"
                    @click="previewStep = 'rating'"
                  />
                </div>
                <UFormField label="Question">
                  <SurveyI18nTextField
                    v-model="question"
                    :locales="enabledLocales"
                    :locale-labels="localeTabLabels"
                    multiline
                  />
                </UFormField>
                <div
                  v-if="type === 'csat'"
                  class="grid gap-3 sm:grid-cols-2"
                >
                  <UFormField label="Low label">
                    <SurveyI18nTextField
                      v-model="appearance.lowLabel!"
                      :locales="enabledLocales"
                      :locale-labels="localeTabLabels"
                    />
                  </UFormField>
                  <UFormField label="High label">
                    <SurveyI18nTextField
                      v-model="appearance.highLabel!"
                      :locales="enabledLocales"
                      :locale-labels="localeTabLabels"
                    />
                  </UFormField>
                </div>
              </div>

              <div class="rounded-lg border border-default p-4 space-y-3 bg-default">
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium">
                    2. Follow-up
                  </p>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    label="Preview"
                    @click="previewStep = 'comment'"
                  />
                </div>
                <UFormField
                  label="Question"
                  hint="Leave empty to skip"
                >
                  <SurveyI18nTextField
                    v-model="followUp"
                    :locales="enabledLocales"
                    :locale-labels="localeTabLabels"
                    multiline
                  />
                </UFormField>
              </div>

              <div class="rounded-lg border border-default p-4 space-y-3 bg-default">
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium">
                    3. Thank you
                  </p>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    label="Preview"
                    @click="previewStep = 'thanks'"
                  />
                </div>
                <UFormField label="Message">
                  <SurveyI18nTextField
                    v-model="thanks"
                    :locales="enabledLocales"
                    :locale-labels="localeTabLabels"
                  />
                </UFormField>
              </div>
            </template>

            <template v-else-if="tab === 'appearance'">
              <UFormField
                label="Default language"
                description="Used in the preview and as the widget fallback"
              >
                <USelect
                  v-model="appearance.locale"
                  class="w-full"
                  :items="localeSelectItems"
                />
              </UFormField>

              <UFormField
                v-if="type === 'csat'"
                label="Scale style"
              >
                <USelect
                  v-model="appearance.scaleStyle"
                  class="w-full"
                  :items="[
                    { label: 'Emojis', value: 'emojis' },
                    { label: 'Stars', value: 'stars' },
                    { label: 'Numbers', value: 'numbers' },
                  ]"
                />
              </UFormField>

              <UFormField label="Background">
                <div class="flex flex-wrap gap-2 items-center">
                  <button
                    v-for="c in colorPresets"
                    :key="`bg-${c}`"
                    type="button"
                    class="size-7 rounded-full border border-default"
                    :class="appearance.background === c ? 'ring-2 ring-primary' : ''"
                    :style="{ background: c }"
                    @click="appearance.background = c"
                  />
                  <UInput
                    v-model="appearance.background"
                    class="w-28"
                    placeholder="#ffffff"
                  />
                </div>
              </UFormField>

              <UFormField label="Button color">
                <div class="flex flex-wrap gap-2 items-center">
                  <button
                    v-for="c in colorPresets.filter(x => x !== '#ffffff')"
                    :key="`btn-${c}`"
                    type="button"
                    class="size-7 rounded-full border border-default"
                    :class="appearance.button === c ? 'ring-2 ring-primary' : ''"
                    :style="{ background: c }"
                    @click="appearance.button = c"
                  />
                  <UInput
                    v-model="appearance.button"
                    class="w-28"
                    placeholder="#16a34a"
                  />
                </div>
              </UFormField>

              <UFormField label="Text color">
                <div class="flex gap-2 items-center">
                  <button
                    type="button"
                    class="size-7 rounded-full border border-default bg-black"
                    :class="appearance.text === '#18181b' ? 'ring-2 ring-primary' : ''"
                    @click="appearance.text = '#18181b'"
                  />
                  <button
                    type="button"
                    class="size-7 rounded-full border border-default bg-white"
                    :class="appearance.text === '#ffffff' ? 'ring-2 ring-primary' : ''"
                    @click="appearance.text = '#ffffff'"
                  />
                  <UInput
                    v-model="appearance.text"
                    class="w-28"
                  />
                </div>
              </UFormField>

              <UFormField label="Position">
                <URadioGroup
                  v-model="appearance.position"
                  :items="[
                    { label: 'Bottom left', value: 'left' },
                    { label: 'Bottom right', value: 'right' },
                  ]"
                />
              </UFormField>
            </template>

            <template v-else-if="tab === 'targeting'">
              <fieldset class="space-y-3">
                <legend class="text-sm font-medium text-highlighted mb-1">
                  Devices
                </legend>
                <p class="text-xs text-muted">
                  Select which devices should see this survey
                </p>
                <div class="flex flex-wrap gap-4">
                  <UCheckbox
                    v-for="d in (['desktop', 'tablet', 'mobile'] as const)"
                    :key="d"
                    :model-value="devices.includes(d)"
                    :label="deviceLabels[d]"
                    @update:model-value="(v: boolean | 'indeterminate') => {
                      if (v) devices = [...new Set([...devices, d])]
                      else devices = devices.filter(x => x !== d)
                    }"
                  />
                </div>
              </fieldset>

              <fieldset class="space-y-3 pt-4 border-t border-default">
                <legend class="text-sm font-medium text-highlighted mb-1">
                  Pages
                </legend>
                <label class="flex items-center gap-2 text-sm">
                  <input
                    v-model="pagesMode"
                    type="radio"
                    value="all"
                  >
                  All pages
                </label>
                <label class="flex items-start gap-2 text-sm">
                  <input
                    v-model="pagesMode"
                    type="radio"
                    value="specific"
                    class="mt-1"
                  >
                  <span class="space-y-1">
                    <span class="block">Specific pages</span>
                    <span class="block text-xs text-muted">Only show on these URLs</span>
                  </span>
                </label>
                <UTextarea
                  v-if="pagesMode === 'specific'"
                  v-model="includePaths"
                  :rows="3"
                  class="w-full"
                  placeholder="/pricing&#10;/checkout"
                />
                <UFormField
                  label="Don't show on"
                  hint="Optional. One path per line."
                >
                  <UTextarea
                    v-model="excludePaths"
                    :rows="2"
                    class="w-full"
                    placeholder="/admin&#10;/login"
                  />
                </UFormField>
              </fieldset>

              <fieldset class="space-y-3 pt-4 border-t border-default">
                <legend class="text-sm font-medium text-highlighted mb-1">
                  How many users
                </legend>
                <label class="flex items-center gap-2 text-sm">
                  <input
                    v-model="trafficMode"
                    type="radio"
                    value="all"
                  >
                  All visitors
                </label>
                <label class="flex items-center gap-2 text-sm flex-wrap">
                  <input
                    v-model="trafficMode"
                    type="radio"
                    value="sample"
                  >
                  A percentage of visitors
                  <UInput
                    v-model.number="sampleRate"
                    type="number"
                    min="1"
                    max="99"
                    class="w-20"
                    :disabled="trafficMode !== 'sample'"
                  />
                  %
                </label>
              </fieldset>
            </template>

            <template v-else>
              <fieldset class="space-y-3">
                <legend class="text-sm font-medium text-highlighted mb-1">
                  When to show
                </legend>
                <label class="flex items-start gap-2 text-sm">
                  <input
                    v-model="triggerType"
                    type="radio"
                    value="manual"
                    class="mt-1"
                  >
                  <span class="space-y-0.5">
                    <span class="block">Only when you trigger it</span>
                    <span class="block text-xs text-muted">From a button or link on your site</span>
                  </span>
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <input
                    v-model="triggerType"
                    type="radio"
                    value="immediate"
                  >
                  Immediately after the page loads
                </label>
                <label class="flex items-center gap-2 text-sm flex-wrap">
                  <input
                    v-model="triggerType"
                    type="radio"
                    value="delay"
                  >
                  After a delay of
                  <UInput
                    v-model.number="triggerMs"
                    type="number"
                    min="0"
                    class="w-20"
                    :disabled="triggerType !== 'delay'"
                  />
                  seconds
                </label>
                <label class="flex items-start gap-2 text-sm">
                  <input
                    v-model="triggerType"
                    type="radio"
                    value="exit_intent"
                    class="mt-1"
                  >
                  <span class="space-y-0.5">
                    <span class="block">When a user is about to leave</span>
                    <span class="block text-xs text-muted">Desktop only — when the cursor leaves the top of the page</span>
                  </span>
                </label>
                <label class="flex items-center gap-2 text-sm flex-wrap">
                  <input
                    v-model="triggerType"
                    type="radio"
                    value="scroll"
                  >
                  When a user scrolls
                  <UInput
                    v-model.number="triggerPercent"
                    type="number"
                    min="1"
                    max="100"
                    class="w-20"
                    :disabled="triggerType !== 'scroll'"
                  />
                  % down the page
                </label>
                <label class="flex items-center gap-2 text-sm flex-wrap">
                  <input
                    v-model="triggerType"
                    type="radio"
                    value="pageviews"
                  >
                  After
                  <UInput
                    v-model.number="triggerCount"
                    type="number"
                    min="1"
                    class="w-20"
                    :disabled="triggerType !== 'pageviews'"
                  />
                  pages in the same visit
                </label>
              </fieldset>

              <fieldset class="space-y-3 pt-4 border-t border-default">
                <legend class="text-sm font-medium text-highlighted mb-1">
                  Screenshots
                </legend>
                <UCheckbox
                  v-model="appearance.includeScreenshot"
                  label="Capture screenshots"
                />
                <p class="text-xs text-muted">
                  See exactly what your users see when they respond. One screenshot per response.
                </p>
              </fieldset>

              <fieldset class="space-y-3 pt-4 border-t border-default">
                <legend class="text-sm font-medium text-highlighted mb-1">
                  How often
                </legend>
                <label class="flex items-start gap-2 text-sm">
                  <input
                    v-model="freqMode"
                    type="radio"
                    value="until_submit"
                    class="mt-1"
                  >
                  <span class="space-y-0.5">
                    <span class="block">Until they submit a response</span>
                    <span class="block text-xs text-muted">If they close it, it can show again later</span>
                  </span>
                </label>
                <label class="flex items-start gap-2 text-sm">
                  <input
                    v-model="freqMode"
                    type="radio"
                    value="once"
                    class="mt-1"
                  >
                  <span class="space-y-0.5">
                    <span class="block">Only once, even if they do not respond</span>
                    <span class="block text-xs text-muted">If they close it, they won't see it again</span>
                  </span>
                </label>
                <label class="flex items-start gap-2 text-sm">
                  <input
                    v-model="freqMode"
                    type="radio"
                    value="always"
                    class="mt-1"
                  >
                  <span class="space-y-0.5">
                    <span class="block">Always, even after they submit</span>
                    <span class="block text-xs text-muted">Shows again on later visits</span>
                  </span>
                </label>
                <label class="flex items-center gap-2 text-sm flex-wrap">
                  <input
                    v-model="freqMode"
                    type="radio"
                    value="cooldown"
                  >
                  Once every
                  <UInput
                    v-model.number="freqDays"
                    type="number"
                    min="1"
                    class="w-20"
                    :disabled="freqMode !== 'cooldown'"
                  />
                  days
                </label>
              </fieldset>
            </template>
          </div>

          <div class="space-y-3 xl:sticky xl:top-4 self-start">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-medium text-highlighted">
                Preview
              </p>
              <UButtonGroup size="xs">
                <UButton
                  :variant="previewStep === 'rating' ? 'solid' : 'ghost'"
                  color="neutral"
                  label="1"
                  @click="previewStep = 'rating'"
                />
                <UButton
                  :variant="previewStep === 'comment' ? 'solid' : 'ghost'"
                  color="neutral"
                  label="2"
                  :disabled="!previewFollowUp"
                  @click="previewStep = 'comment'"
                />
                <UButton
                  :variant="previewStep === 'thanks' ? 'solid' : 'ghost'"
                  color="neutral"
                  label="✓"
                  @click="previewStep = 'thanks'"
                />
              </UButtonGroup>
            </div>
            <SurveyPreview
              :question="previewQuestion"
              :follow-up="previewFollowUp"
              :thanks="previewThanks"
              :appearance="appearance"
              :type="type"
              :step="previewStep"
            />
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
