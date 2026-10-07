<script setup lang="ts">
type DailyPoint = { day: string, count: number, csatPercent: number | null }

type Series = {
  id: string
  name: string
  color: string
  daily: DailyPoint[]
}

const props = defineProps<{
  daily: DailyPoint[]
  series?: Series[]
}>()

const grouped = computed(() => (props.series?.length || 0) > 1)

const maxCount = computed(() => {
  if (!grouped.value) {
    return Math.max(1, ...props.daily.map(d => d.count))
  }
  return Math.max(
    1,
    ...(props.series || []).flatMap(s => s.daily.map(p => p.count)),
  )
})

const total = computed(() => props.daily.reduce((n, d) => n + d.count, 0))

const points = computed(() => {
  const data = props.daily
  const sparse = total.value <= 5 && data.length > 14
  return sparse ? data.slice(-14) : data
})

function countFor(series: Series, day: string) {
  return series.daily.find(p => p.day === day)?.count || 0
}

function dayTotal(day: string) {
  if (!grouped.value) {
    return props.daily.find(p => p.day === day)?.count || 0
  }
  return (props.series || []).reduce((sum, s) => sum + countFor(s, day), 0)
}

function titleFor(day: string) {
  if (!grouped.value) {
    const point = props.daily.find(p => p.day === day)
    return `${day}: ${point?.count || 0} responses${point?.csatPercent != null ? `, CSAT ${point.csatPercent}%` : ''}`
  }
  const parts = (props.series || [])
    .filter(s => countFor(s, day) > 0)
    .map(s => `${s.name}: ${countFor(s, day)}`)
  return `${day}: ${dayTotal(day)} total${parts.length ? ` · ${parts.join(' · ')}` : ''}`
}

function label(day: string) {
  const d = new Date(`${day}T12:00:00`)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function barHeight(count: number) {
  if (!count) return '2px'
  return `${Math.max(8, (count / maxCount.value) * 100)}%`
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
    <div class="flex flex-col h-40 px-0.5">
      <!-- Day totals above the plot so % bar heights share one baseline -->
      <div class="flex gap-px sm:gap-1 h-4 shrink-0">
        <div
          v-for="point in points"
          :key="`label-${point.day}`"
          class="flex-1 min-w-0 flex justify-center items-end"
        >
          <span
            v-if="dayTotal(point.day)"
            class="text-[10px] leading-none text-muted tabular-nums"
          >{{ dayTotal(point.day) }}</span>
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-hidden flex items-end gap-px sm:gap-1">
        <div
          v-for="point in points"
          :key="point.day"
          class="flex-1 min-w-0 h-full flex items-end justify-center"
          :title="titleFor(point.day)"
        >
          <div
            v-if="grouped"
            class="w-full max-w-12 h-full flex items-end justify-center gap-0.5"
          >
            <div
              v-for="s in series"
              :key="s.id"
              class="flex-1 min-w-[3px] max-w-3.5 self-end rounded-t-sm"
              :class="countFor(s, point.day) ? '' : 'bg-elevated/80'"
              :style="{
                backgroundColor: countFor(s, point.day) ? s.color : undefined,
                height: barHeight(countFor(s, point.day)),
              }"
            />
          </div>

          <div
            v-else
            class="w-full max-w-8 self-end rounded-t-sm transition-colors"
            :class="point.count ? 'bg-primary' : 'bg-elevated'"
            :style="{ height: barHeight(point.count) }"
          />
        </div>
      </div>
    </div>
    <div class="flex justify-between text-[11px] text-muted">
      <span>{{ label(points[0]!.day) }}</span>
      <span>{{ label(points[points.length - 1]!.day) }}</span>
    </div>
    <div
      v-if="grouped"
      class="flex flex-wrap gap-x-3 gap-y-1.5 pt-0.5"
    >
      <span
        v-for="s in series"
        :key="s.id"
        class="inline-flex items-center gap-1.5 text-[11px] text-muted"
      >
        <span
          class="size-2.5 rounded-sm shrink-0 ring-1 ring-black/10 dark:ring-white/15"
          :style="{ backgroundColor: s.color }"
        />
        <span class="truncate max-w-36">{{ s.name }}</span>
      </span>
    </div>
  </div>
</template>
