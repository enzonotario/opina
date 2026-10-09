<script setup lang="ts">
import { barY, colorLegend, colorLegendItems, defineChart } from '@tanstack/charts'
import { group } from '@tanstack/charts/group'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleOrdinal } from '@tanstack/charts/scales/ordinal'
import { tooltip } from '@tanstack/charts/tooltip'
import { Chart } from '@tanstack/charts/vue'

type DailyPoint = { day: string, count: number, csatPercent: number | null }

type Series = {
  id: string
  name: string
  color: string
  daily: DailyPoint[]
}

type Row = {
  day: string
  count: number
  series: string
  csatPercent: number | null
}

const props = defineProps<{
  daily: DailyPoint[]
  series?: Series[]
}>()

const grouped = computed(() => (props.series?.length || 0) > 1)

const total = computed(() => props.daily.reduce((n, d) => n + d.count, 0))

const points = computed(() => {
  const data = props.daily
  const sparse = total.value <= 5 && data.length > 14
  return sparse ? data.slice(-14) : data
})

const rows = computed<Row[]>(() => {
  if (!grouped.value) {
    return points.value.map(point => ({
      day: point.day,
      count: point.count,
      series: 'Responses',
      csatPercent: point.csatPercent,
    }))
  }
  return (props.series || []).flatMap(series =>
    points.value.map(point => {
      const match = series.daily.find(p => p.day === point.day)
      return {
        day: point.day,
        count: match?.count || 0,
        series: series.name,
        csatPercent: match?.csatPercent ?? null,
      }
    }),
  )
})

const maxCount = computed(() => Math.max(1, ...rows.value.map(row => row.count)))

function dayLabel(day: string) {
  const date = new Date(`${day}T12:00:00`)
  if (Number.isNaN(date.getTime())) return day
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function tip(row: Row) {
  const csat = row.csatPercent != null ? ` · CSAT ${row.csatPercent}%` : ''
  return `${row.count}${csat}`
}

const definition = computed(() => {
  const data = rows.value
  const series = props.series || []
  const mark = grouped.value
    ? barY(data, {
        x: 'day',
        y: 'count',
        z: 'series',
        color: 'series',
        layout: group({ padding: 0.15 }),
        maxThickness: 14,
        radius: { end: 2 },
      })
    : barY(data, {
        x: 'day',
        y: 'count',
        fill: 'var(--ui-primary)',
        maxThickness: 28,
        radius: { end: 2 },
      })

  return defineChart({
    marks: [mark],
    scales: {
      x: {
        scale: () => scaleBand<string>().padding(grouped.value ? 0.28 : 0.35),
        axis: {
          line: false,
          ticks: {
            line: false,
            format: (value: string) => dayLabel(value),
          },
          tickLabels: {
            fontSize: 11,
            thin: { priority: 'ends', minGap: 56 },
          },
        },
      },
      y: {
        scale: scaleLinear().domain([0, maxCount.value]),
        grid: true,
        axis: {
          line: false,
          ticks: {
            count: 4,
            line: false,
            format: (value: number) => String(Math.round(value)),
          },
          tickLabels: { fontSize: 11 },
        },
      },
    },
    ...(grouped.value
      ? {
          color: {
            scale: scaleOrdinal(
              series.map(item => item.name),
              series.map(item => item.color),
            ),
            legend: colorLegend({
              placement: 'bottom',
              items: colorLegendItems({ justify: 'start', gap: 12 }),
            }),
          },
        }
      : {}),
  }, {
    tooltip: {
      use: tooltip,
      format: point => tip(point.datum as Row),
      formatGroup: (focused) => {
        const day = String(focused[0]?.xValue ?? '')
        return dayLabel(day)
      },
    },
  })
})
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
  <Chart
    v-else
    :definition="definition"
    aria-label="Responses per day"
    :height="176"
    :initial-width="640"
    class="w-full text-muted"
  />
</template>
