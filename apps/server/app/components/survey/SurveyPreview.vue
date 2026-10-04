<script setup lang="ts">
import type { SurveyAppearance } from '../../../shared/surveys'

const props = defineProps<{
  question: string
  followUp: string
  thanks: string
  appearance: SurveyAppearance
  type: 'csat' | 'thumbs'
  step?: 'rating' | 'comment' | 'thanks'
}>()

const step = computed(() => props.step || 'rating')

const emojis = ['😠', '🙁', '😐', '🙂', '😍']
const stars = ['★', '★', '★', '★', '★']

const selected = ref<number | null>(null)

const styleVars = computed(() => ({
  '--pv-bg': props.appearance.background || '#fff',
  '--pv-btn': props.appearance.button || '#16a34a',
  '--pv-text': props.appearance.text || '#18181b',
}))

const positionClass = computed(() =>
  props.appearance.position === 'left' ? 'items-end justify-start' : 'items-end justify-end',
)

function pickLabel(map: Record<string, string> | undefined, fallback: string) {
  if (!map) return fallback
  const locale = props.appearance.locale || 'es'
  return map[locale] || map.es || map.en || Object.values(map).find(Boolean) || fallback
}

const low = computed(() => pickLabel(props.appearance.lowLabel, 'Muy insatisfecho'))
const high = computed(() => pickLabel(props.appearance.highLabel, 'Muy satisfecho'))

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
    class="relative h-[420px] rounded-xl border border-default bg-elevated/40 overflow-hidden"
    :class="positionClass"
    style="display: flex; padding: 16px;"
  >
    <div class="absolute inset-4 rounded-lg bg-default/60 border border-dashed border-default pointer-events-none">
      <div class="h-8 border-b border-dashed border-default" />
      <div class="p-4 space-y-2 opacity-40">
        <div class="h-3 w-2/3 rounded bg-muted" />
        <div class="h-3 w-1/2 rounded bg-muted" />
        <div class="h-3 w-3/4 rounded bg-muted" />
      </div>
    </div>

    <div
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
</template>
