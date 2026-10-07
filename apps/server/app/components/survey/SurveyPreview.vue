<script setup lang="ts">
import type { SurveyAppearance } from '#shared/surveys'
import { DEFAULT_HELPFUL_OPTIONS } from '#shared/surveys'

export type PreviewDevice = 'mobile' | 'tablet' | 'desktop'

const props = withDefaults(defineProps<{
  question: string
  followUp: string
  thanks: string
  appearance: SurveyAppearance
  type: 'csat' | 'thumbs' | 'helpful'
  step?: 'rating' | 'comment' | 'thanks'
  device?: PreviewDevice
}>(), {
  step: 'rating',
  device: 'desktop',
})

const step = computed(() => props.step || 'rating')

const emojis = ['😠', '🙁', '😐', '🙂', '😍']
const stars = ['★', '★', '★', '★', '★']

const selected = ref<number | null>(null)

const styleVars = computed(() => ({
  '--pv-bg': props.appearance.background || '#fff',
  '--pv-btn': props.appearance.button || '#16a34a',
  '--pv-text': props.appearance.text || '#18181b',
}))

const positionClass = computed(() => {
  if (props.type === 'helpful') return 'items-center justify-center'
  return props.appearance.position === 'left' ? 'items-end justify-start' : 'items-end justify-end'
})

const frame = computed(() => {
  if (props.device === 'mobile') return { width: 375, height: 667, label: '375 × 667' }
  if (props.device === 'tablet') return { width: 768, height: 560, label: '768 × 560' }
  return { width: 1100, height: 560, label: 'Desktop' }
})

const shellRef = ref<HTMLElement | null>(null)
const scale = ref(1)

function updateScale() {
  const el = shellRef.value
  if (!el) return
  const available = el.clientWidth
  const target = frame.value.width
  scale.value = available >= target ? 1 : Math.max(0.35, available / target)
}

let resizeObserver: ResizeObserver | null = null

watch(() => props.device, async () => {
  await nextTick()
  updateScale()
})

onMounted(() => {
  updateScale()
  if (typeof ResizeObserver === 'undefined' || !shellRef.value) return
  resizeObserver = new ResizeObserver(() => updateScale())
  resizeObserver.observe(shellRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})


function pickLabel(map: Record<string, string> | undefined, fallback: string) {
  if (!map) return fallback
  const locale = props.appearance.locale || 'es'
  return map[locale] || map.es || map.en || Object.values(map).find(Boolean) || fallback
}

const low = computed(() => pickLabel(props.appearance.lowLabel, 'Muy insatisfecho'))
const high = computed(() => pickLabel(props.appearance.highLabel, 'Muy satisfecho'))

const helpfulPills = computed(() => {
  const options = props.appearance.options?.length === 4
    ? props.appearance.options
    : DEFAULT_HELPFUL_OPTIONS
  return [...options]
    .sort((a, b) => b.value - a.value)
    .map(o => ({
      value: o.value,
      label: pickLabel(o.label, String(o.value)),
    }))
})

const logoUrl = computed(() => (props.appearance.imageUrl || '').trim())

const nextLabel = computed(() =>
  props.appearance.locale === 'en' ? 'Next' : 'Siguiente',
)
const sendLabel = computed(() =>
  props.appearance.locale === 'en' ? 'Send' : 'Enviar',
)
const closeLabel = computed(() =>
  props.appearance.locale === 'en' ? 'Close' : 'Cerrar',
)
</script>

<template>
  <div
    ref="shellRef"
    class="w-full overflow-hidden"
  >
    <div
      class="mx-auto origin-top transition-[width] duration-200"
      :style="{
        width: `${frame.width * scale}px`,
        height: `${frame.height * scale}px`,
      }"
    >
      <div
        class="relative rounded-xl border border-default bg-elevated/40 overflow-hidden origin-top-left"
        :class="positionClass"
        :style="{
          width: `${frame.width}px`,
          height: `${frame.height}px`,
          transform: `scale(${scale})`,
          display: 'flex',
          padding: device === 'mobile' ? '12px' : '20px',
        }"
      >
        <div class="absolute inset-3 sm:inset-4 rounded-lg bg-default/60 border border-dashed border-default pointer-events-none">
          <div class="h-8 border-b border-dashed border-default flex items-center gap-1.5 px-3">
            <span class="size-2 rounded-full bg-muted" />
            <span class="size-2 rounded-full bg-muted" />
            <span class="size-2 rounded-full bg-muted" />
            <span class="ml-2 h-3 flex-1 max-w-[40%] rounded bg-muted/80" />
          </div>
          <div
            class="p-4 space-y-2 opacity-40"
            :class="device === 'desktop' ? 'max-w-2xl' : ''"
          >
            <div class="h-3 w-2/3 rounded bg-muted" />
            <div class="h-3 w-1/2 rounded bg-muted" />
            <div class="h-3 w-3/4 rounded bg-muted" />
            <div
              v-if="device !== 'mobile'"
              class="h-3 w-1/3 rounded bg-muted"
            />
          </div>
        </div>

        <div
          v-if="type === 'helpful'"
          class="relative z-10 w-full rounded-xl border border-black/10 p-4"
          :class="device === 'desktop' ? 'max-w-[520px]' : 'max-w-full'"
          :style="{ background: 'var(--pv-bg)', color: 'var(--pv-text)', ...styleVars }"
        >
          <template v-if="step === 'rating'">
            <div class="flex items-center gap-2.5 mb-3">
              <img
                v-if="logoUrl"
                :src="logoUrl"
                alt=""
                class="size-9 rounded-lg object-contain shrink-0"
                loading="lazy"
                decoding="async"
                referrerpolicy="no-referrer"
              >
              <p class="text-sm font-semibold leading-snug m-0">
                {{ question || '…' }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="pill in helpfulPills"
                :key="pill.value"
                type="button"
                class="rounded-full border border-black/10 px-3.5 py-1.5 text-sm font-medium"
                :class="selected === pill.value ? 'ring-2' : 'hover:bg-black/5'"
                :style="selected === pill.value ? { outlineColor: 'var(--pv-btn)', borderColor: 'var(--pv-btn)' } : {}"
                @click="selected = pill.value"
              >
                {{ pill.label }}
              </button>
            </div>
          </template>

          <template v-else-if="step === 'comment'">
            <div class="flex items-center gap-2.5 mb-3">
              <img
                v-if="logoUrl"
                :src="logoUrl"
                alt=""
                class="size-9 rounded-lg object-contain shrink-0"
                loading="lazy"
                decoding="async"
                referrerpolicy="no-referrer"
              >
              <p class="text-sm font-semibold leading-snug m-0">
                {{ followUp || '…' }}
              </p>
            </div>
            <div class="h-20 rounded-lg border border-black/10 mb-3 bg-black/5" />
            <div class="flex justify-end">
              <button
                type="button"
                class="rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
                :style="{ background: 'var(--pv-btn)' }"
              >
                {{ sendLabel }}
              </button>
            </div>
          </template>

          <template v-else>
            <div class="flex items-center gap-2.5">
              <img
                v-if="logoUrl"
                :src="logoUrl"
                alt=""
                class="size-9 rounded-lg object-contain shrink-0"
                loading="lazy"
                decoding="async"
                referrerpolicy="no-referrer"
              >
              <p class="text-sm font-semibold leading-snug m-0">
                {{ thanks || '¡Gracias!' }}
              </p>
            </div>
          </template>
        </div>

        <div
          v-else
          class="relative z-10 w-full max-w-[320px] rounded-2xl shadow-xl border border-black/5 p-4"
          :style="{ background: 'var(--pv-bg)', color: 'var(--pv-text)', ...styleVars }"
        >
          <div class="flex justify-end mb-1">
            <span class="opacity-50 text-lg leading-none">×</span>
          </div>

          <template v-if="step === 'rating'">
            <p class="text-sm font-semibold leading-snug mb-3">
              {{ question || '…' }}
            </p>

            <div
              v-if="type === 'thumbs'"
              class="flex gap-3 mb-2"
            >
              <button
                v-for="(label, i) in ['👍', '👎']"
                :key="i"
                type="button"
                class="size-11 rounded-xl border border-black/10 text-xl"
                :class="selected === (i === 0 ? 1 : 0) ? 'ring-2' : ''"
                :style="selected === (i === 0 ? 1 : 0) ? { outlineColor: 'var(--pv-btn)' } : {}"
                @click="selected = i === 0 ? 1 : 0"
              >
                {{ label }}
              </button>
            </div>

            <template v-else>
              <div class="flex justify-between gap-1 mb-1">
                <button
                  v-for="n in 5"
                  :key="n"
                  type="button"
                  class="size-11 rounded-xl border border-black/10 text-xl flex items-center justify-center"
                  :class="selected === n ? 'ring-2 ring-offset-1' : 'hover:bg-black/5'"
                  @click="selected = n"
                >
                  <span v-if="appearance.scaleStyle === 'emojis'">{{ emojis[n - 1] }}</span>
                  <span
                    v-else-if="appearance.scaleStyle === 'stars'"
                    :style="{ color: selected != null && n <= selected ? 'var(--pv-btn)' : '#d4d4d8' }"
                  >{{ stars[n - 1] }}</span>
                  <span
                    v-else
                    class="text-sm font-semibold"
                  >{{ n }}</span>
                </button>
              </div>
              <div class="flex justify-between text-[10px] opacity-70 mb-3 px-0.5">
                <span>{{ low }}</span>
                <span>{{ high }}</span>
              </div>
            </template>

            <div class="flex justify-end">
              <button
                type="button"
                class="rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                :style="{ background: 'var(--pv-btn)' }"
                :disabled="selected == null"
              >
                {{ followUp ? nextLabel : sendLabel }}
              </button>
            </div>
          </template>

          <template v-else-if="step === 'comment'">
            <p class="text-sm font-semibold leading-snug mb-3">
              {{ followUp || '…' }}
            </p>
            <div class="h-20 rounded-lg border border-black/10 mb-3 bg-black/5" />
            <div class="flex justify-end">
              <button
                type="button"
                class="rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
                :style="{ background: 'var(--pv-btn)' }"
              >
                {{ sendLabel }}
              </button>
            </div>
          </template>

          <template v-else>
            <p class="text-sm font-semibold leading-snug mb-4 text-center">
              {{ thanks || '¡Gracias!' }}
            </p>
            <div class="flex justify-center">
              <button
                type="button"
                class="rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
                :style="{ background: 'var(--pv-btn)' }"
              >
                {{ closeLabel }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
    <p class="mt-2 text-center text-[11px] text-muted tabular-nums">
      {{ frame.label }}
      <span v-if="scale < 0.999"> · scaled {{ Math.round(scale * 100) }}%</span>
    </p>
  </div>
</template>
