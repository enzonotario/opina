<script setup lang="ts">
const props = defineProps<{
  daily: Array<{ day: string, count: number, csatPercent: number | null }>
}>()

const maxCount = computed(() => Math.max(1, ...props.daily.map(d => d.count)))
const total = computed(() => props.daily.reduce((n, d) => n + d.count, 0))

const points = computed(() => {
  const data = props.daily
  const sparse = total.value <= 5 && data.length > 14
  return sparse ? data.slice(-14) : data
})

function label(day: string) {
  const d = new Date(`${day}T12:00:00`)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div
    v-if="total === 0"
    class="h-40 flex flex-col items-center justify-center rounded-lg bg-elevated/50 border border-dashed border-default text-sm text-muted gap-1"
  >
    <UIcon
      name="i-lucide-bar-chart-3"
      class="size-6 opacity-40"
    />
    <span>No responses in this period</span>
  </div>
  <div
    v-else
    class="space-y-3"
  >
    <div class="flex items-end gap-px sm:gap-1 h-40 px-0.5">
      <div
        v-for="point in points"
        :key="point.day"
        class="flex-1 min-w-0 h-full flex flex-col justify-end items-center"
        :title="`${point.day}: ${point.count} responses${point.csatPercent != null ? `, CSAT ${point.csatPercent}%` : ''}`"
      >
        <span
          v-if="point.count"
          class="text-[10px] text-muted mb-1 tabular-nums"
        >{{ point.count }}</span>
        <div
          class="w-full max-w-8 rounded-t-sm transition-colors"
          :class="point.count ? 'bg-primary' : 'bg-elevated'"
          :style="{
            height: point.count ? `${Math.max(8, (point.count / maxCount) * 100)}%` : '2px',
          }"
        />
      </div>
    </div>
    <div class="flex justify-between text-[11px] text-muted">
      <span>{{ label(points[0]!.day) }}</span>
      <span>{{ label(points[points.length - 1]!.day) }}</span>
    </div>
  </div>
</template>
